package queue

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisQueue struct {
	client   *redis.Client
	readyKey string
	leaseTTL time.Duration
}

func NewRedisQueue(addr string, password string, db int, readyKey string, leaseTTL time.Duration) *RedisQueue {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	return &RedisQueue{
		client:   client,
		readyKey: readyKey,
		leaseTTL: leaseTTL,
	}
}

func (q *RedisQueue) Close() error {
	return q.client.Close()
}

func (q *RedisQueue) Ping(ctx context.Context) error {
	return q.client.Ping(ctx).Err()
}

func (q *RedisQueue) EnqueueJob(ctx context.Context, jobID string) error {
	return q.client.LPush(ctx, q.readyKey, jobID).Err()
}

func (q *RedisQueue) RemoveQueuedJob(ctx context.Context, jobID string) error {
	return q.client.LRem(ctx, q.readyKey, 0, jobID).Err()
}

func (q *RedisQueue) DequeueJob(ctx context.Context, timeout time.Duration) (string, error) {
	result, err := q.client.BRPop(ctx, timeout, q.readyKey).Result()
	if errors.Is(err, redis.Nil) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if len(result) != 2 {
		return "", fmt.Errorf("unexpected BRPOP response length: %d", len(result))
	}
	return result[1], nil
}

func (q *RedisQueue) AcquireLease(ctx context.Context, jobID string, workerID string) (bool, error) {
	key := fmt.Sprintf("job:lease:%s", jobID)
	return q.client.SetNX(ctx, key, workerID, q.leaseTTL).Result()
}

func (q *RedisQueue) ReleaseLease(ctx context.Context, jobID string) error {
	key := fmt.Sprintf("job:lease:%s", jobID)
	return q.client.Del(ctx, key).Err()
}
