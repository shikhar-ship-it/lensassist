import { useState } from "react";
import type { ToolCall } from "../types";

export function ToolTrace({ trace }: { trace: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  if (!trace?.length) return null;
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-2">
        {trace.map((t, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 bg-brand-50 border border-brand-100 text-brand-500 text-[11px] font-semibold px-2.5 py-1 rounded-full"
          >
            🔧 {t.tool}
          </span>
        ))}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-[11px] text-slate-500 hover:text-brand-500 font-medium underline-offset-2 hover:underline"
        >
          {expanded ? "Hide reasoning" : "View reasoning"}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 space-y-3 bg-slate-50 rounded-lg p-3 border border-slate-200">
          {trace.map((t, i) => (
            <div key={i}>
              <div className="text-xs font-bold text-brand-500">
                Step {i + 1} — {t.tool}
              </div>
              <pre className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 mt-1 overflow-x-auto">
                {JSON.stringify(t.input, null, 2)}
              </pre>
              <pre className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 mt-1 whitespace-pre-wrap">
                {t.output}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
