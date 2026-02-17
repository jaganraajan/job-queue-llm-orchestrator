export const KpiCard = ({
  label,
  value,
  hint,
  tone = "neutral"
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "warn" | "good";
}) => (
  <article className={`kpi-card kpi-${tone}`}>
    <p>{label}</p>
    <h3>{value}</h3>
    <span>{hint}</span>
  </article>
);
