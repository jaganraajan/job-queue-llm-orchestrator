package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"job-queue-llm-orchestrator/backend/internal/jobs"
	"job-queue-llm-orchestrator/backend/internal/models"
	"job-queue-llm-orchestrator/backend/internal/store"
)

type Server struct {
	service *jobs.Service
	mux     *http.ServeMux
}

func NewServer(service *jobs.Service) *Server {
	server := &Server{
		service: service,
		mux:     http.NewServeMux(),
	}
	server.routes()
	return server
}

func (s *Server) Handler() http.Handler {
	return s.mux
}

func (s *Server) routes() {
	s.mux.HandleFunc("/healthz", s.handleHealthz)
	s.mux.HandleFunc("/v1/jobs", s.handleJobs)
	s.mux.HandleFunc("/v1/jobs/", s.handleJobByID)
}

func (s *Server) handleHealthz(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleJobs(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		s.handleListJobs(w, r)
	case http.MethodPost:
		s.handleCreateJob(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
	}
}

func (s *Server) handleListJobs(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query()
	status := strings.TrimSpace(query.Get("status"))
	tenant := strings.TrimSpace(query.Get("tenant"))
	model := strings.TrimSpace(query.Get("model"))

	limit := 100
	if rawLimit := strings.TrimSpace(query.Get("limit")); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil || parsedLimit <= 0 {
			writeError(w, http.StatusBadRequest, "validation_error", "limit must be a positive integer")
			return
		}
		limit = parsedLimit
	}

	jobsList, err := s.service.ListJobs(r.Context(), status, tenant, model, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, listJobsResponse{Jobs: jobsList})
}

func (s *Server) handleCreateJob(w http.ResponseWriter, r *http.Request) {
	var request createJobRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_json", "Request body must be valid JSON")
		return
	}

	if request.TenantID == "" || request.Model == "" {
		writeError(w, http.StatusBadRequest, "validation_error", "tenant_id and model are required")
		return
	}

	idempotencyKey := r.Header.Get("Idempotency-Key")
	if idempotencyKey == "" {
		idempotencyKey = request.IdempotencyKey
	}

	input := models.CreateJobInput{
		TenantID:       request.TenantID,
		Priority:       request.Priority,
		Model:          request.Model,
		PayloadJSON:    request.Payload,
		IdempotencyKey: idempotencyKey,
		MaxAttempts:    request.MaxAttempts,
	}

	job, existing, err := s.service.CreateJob(r.Context(), input)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	statusCode := http.StatusCreated
	if existing {
		statusCode = http.StatusOK
	}

	writeJSON(w, statusCode, createJobResponse{
		Job:              job,
		IdempotentReplay: existing,
	})
}

func (s *Server) handleJobByID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	jobID := strings.TrimPrefix(r.URL.Path, "/v1/jobs/")
	jobID = strings.TrimSpace(jobID)
	if jobID == "" || strings.Contains(jobID, "/") {
		writeError(w, http.StatusNotFound, "not_found", "Job not found")
		return
	}

	snapshot, err := s.service.GetJob(r.Context(), jobID)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			writeError(w, http.StatusNotFound, "not_found", "Job not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, snapshot)
}

type createJobRequest struct {
	TenantID       string          `json:"tenant_id"`
	Priority       int             `json:"priority"`
	Model          string          `json:"model"`
	Payload        json.RawMessage `json:"payload"`
	IdempotencyKey string          `json:"idempotency_key"`
	MaxAttempts    int             `json:"max_attempts"`
}

type createJobResponse struct {
	Job              models.Job `json:"job"`
	IdempotentReplay bool       `json:"idempotent_replay"`
}

type listJobsResponse struct {
	Jobs []models.Job `json:"jobs"`
}

type errorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, statusCode int, code string, message string) {
	writeJSON(w, statusCode, errorResponse{
		Code:    code,
		Message: message,
	})
}
