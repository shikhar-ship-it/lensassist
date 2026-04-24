interface Metric {
  label: string;
  value: string;
  delta: string;
  accent: "blue" | "green" | "amber" | "purple";
}

const ACCENTS: Record<Metric["accent"], string> = {
  blue: "border-brand-500",
  green: "border-emerald-500",
  amber: "border-amber-500",
  purple: "border-violet-500",
};

const METRICS: Metric[] = [
  {
    label: "Avg Resolution TAT",
    value: "~2 min",
    delta: "↓ 99% vs 28 hr baseline",
    accent: "blue",
  },
  {
    label: "Tier-1 Auto-Resolution",
    value: "~70%",
    delta: "LLM + RAG + tool-use",
    accent: "green",
  },
  {
    label: "Est. Annual CX Savings",
    value: "₹1.2 Cr",
    delta: "Projected at full rollout",
    accent: "amber",
  },
  {
    label: "Powered by",
    value: "Claude Sonnet 4.5",
    delta: "on AWS Bedrock",
    accent: "purple",
  },
];

export function MetricsStrip() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {METRICS.map((m) => (
        <div
          key={m.label}
          className={`bg-slate-100 border-l-4 ${ACCENTS[m.accent]} rounded-lg px-4 py-3`}
        >
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
            {m.label}
          </div>
          <div className="text-lg font-bold text-brand-900 mt-1">{m.value}</div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1">
            {m.delta}
          </div>
        </div>
      ))}
    </div>
  );
}
