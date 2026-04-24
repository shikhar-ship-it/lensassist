import { useState } from "react";
import type { Case, Customer, NewCustomerPayload } from "../types";

interface Props {
  customers: Record<string, Customer>;
  selectedId: string;
  cases: Case[];
  voiceOut: boolean;
  voiceRate: number;
  inputLang: string;
  voiceBackend: "polly" | "browser" | "unknown";
  memoryInfo: { active: string; table?: string | null } | null;
  isAdmin: boolean;
  onSelect: (id: string) => void;
  onCreate: (payload: NewCustomerPayload) => Promise<void>;
  onResetMemory: () => Promise<void>;
  onVoiceOutChange: (on: boolean) => void;
  onVoiceRateChange: (r: number) => void;
  onInputLangChange: (lang: string) => void;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const PRIORITY_BORDER: Record<string, string> = {
  High: "border-l-red-500",
  Medium: "border-l-amber-500",
  Low: "border-l-slate-400",
};

const PRIORITY_PILL: Record<string, string> = {
  High: "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-slate-100 text-slate-600",
};

function NewCustomerForm({
  onCreate,
  onClose,
}: {
  onCreate: Props["onCreate"];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [gold, setGold] = useState(false);
  const [ltv, setLtv] = useState(0);
  const [rightSph, setRightSph] = useState("");
  const [leftSph, setLeftSph] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        city: city.trim(),
        gold_member: gold,
        lifetime_value: ltv,
        right_sph: rightSph.trim() || "0.00",
        left_sph: leftSph.trim() || "0.00",
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 mt-2">
      <input
        placeholder="Name *"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <input
        placeholder="Phone"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <input
        placeholder="City"
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Right SPH"
          value={rightSph}
          onChange={(e) => setRightSph(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <input
          placeholder="Left SPH"
          value={leftSph}
          onChange={(e) => setLeftSph(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={gold}
            onChange={(e) => setGold(e.target.checked)}
          />
          Gold member
        </label>
        <input
          type="number"
          placeholder="LTV ₹"
          value={ltv || ""}
          onChange={(e) => setLtv(Number(e.target.value) || 0)}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg"
      >
        {saving ? "Creating…" : "Create customer"}
      </button>
    </form>
  );
}

export function Sidebar({
  customers,
  selectedId,
  cases,
  voiceOut,
  voiceRate,
  inputLang,
  voiceBackend,
  memoryInfo,
  isAdmin,
  onSelect,
  onCreate,
  onResetMemory,
  onVoiceOutChange,
  onVoiceRateChange,
  onInputLangChange,
}: Props) {
  const [showNew, setShowNew] = useState(false);
  const selected = customers[selectedId];
  const openCases = cases.filter((c) => c.status === "Open");

  if (!selected) return null;

  return (
    <aside className="w-80 h-full bg-white border-r border-slate-200 p-4 overflow-y-auto chat-scroll flex flex-col gap-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500 mb-2">
          {isAdmin ? "Active Customer" : "Your profile"}
        </div>
        {isAdmin && (
          <select
            value={selectedId}
            onChange={(e) => onSelect(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {Object.values(customers).map((c) => (
              <option key={c.customer_id} value={c.customer_id}>
                {c.customer_id} · {c.name}
              </option>
            ))}
          </select>
        )}
        <div className="mt-3 p-3 rounded-xl bg-gradient-to-br from-slate-100 to-white border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-500 to-brand-900 text-white font-bold grid place-items-center">
              {initials(selected.name)}
            </div>
            <div>
              <div className="font-bold text-brand-900">{selected.name}</div>
              <div className="text-xs text-slate-500">
                📍 {selected.city} · 📞 {selected.phone}
              </div>
            </div>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            💰 LTV ₹{selected.lifetime_value.toLocaleString()}
          </div>
          {selected.gold_member && (
            <div className="inline-block mt-2 px-2 py-0.5 text-[10px] font-bold tracking-wide rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950">
              ⭐ GOLD MEMBER
            </div>
          )}
        </div>
        {isAdmin && (
          <>
            <button
              onClick={() => setShowNew((s) => !s)}
              className="w-full mt-2 text-sm text-brand-500 hover:text-brand-600 font-medium py-2"
            >
              {showNew ? "— Cancel" : "➕ Add a new customer"}
            </button>
            {showNew && (
              <NewCustomerForm onCreate={onCreate} onClose={() => setShowNew(false)} />
            )}
          </>
        )}
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500 mb-2">
          Open Salesforce Cases
        </div>
        {openCases.length === 0 ? (
          <div className="text-xs text-slate-400 italic">No open cases</div>
        ) : (
          <div className="space-y-2">
            {openCases.map((c) => (
              <div
                key={c.case_id}
                className={`bg-white rounded-lg p-3 border border-slate-200 border-l-4 ${
                  PRIORITY_BORDER[c.priority] ?? "border-l-slate-400"
                }`}
              >
                <div className="text-[10px] font-bold tracking-wider text-brand-500">
                  {c.case_id}
                </div>
                <div className="text-xs text-brand-900 leading-snug mt-0.5">
                  {c.subject}
                </div>
                <div
                  className={`inline-block mt-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full ${
                    PRIORITY_PILL[c.priority] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {c.priority}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-slate-500 mb-2">
          Voice
        </div>
        <div className="mb-2">
          <div className="text-xs text-slate-500 mb-1">🎙️ Speak-in language</div>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => onInputLangChange("en-IN")}
              className={`text-xs font-semibold py-1.5 rounded-md transition-colors ${
                inputLang === "en-IN"
                  ? "bg-white text-brand-900 shadow-sm"
                  : "text-slate-500 hover:text-brand-900"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => onInputLangChange("hi-IN")}
              className={`text-xs font-semibold py-1.5 rounded-md transition-colors ${
                inputLang === "hi-IN"
                  ? "bg-white text-brand-900 shadow-sm"
                  : "text-slate-500 hover:text-brand-900"
              }`}
            >
              हिन्दी
            </button>
          </div>
          <div className="text-[10px] text-slate-400 mt-1 leading-tight">
            Reply language auto-detects from your message.
          </div>
        </div>
        <label className="flex items-center justify-between text-sm py-1">
          <span>🔊 Speak replies</span>
          <input
            type="checkbox"
            checked={voiceOut}
            onChange={(e) => onVoiceOutChange(e.target.checked)}
          />
        </label>
        <div className="text-[10px] mt-1 flex items-center gap-1.5">
          {voiceBackend === "polly" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-700 font-semibold">
                Polly Neural · Kajal
              </span>
            </>
          )}
          {voiceBackend === "browser" && (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span className="text-amber-700 font-semibold">Browser voice (fallback)</span>
            </>
          )}
          {voiceBackend === "unknown" && (
            <span className="text-slate-400">Detecting voice backend…</span>
          )}
        </div>
        <div className="mt-2">
          <div className="text-xs text-slate-500 mb-1">
            Speech rate · {voiceRate.toFixed(2)}×
          </div>
          <input
            type="range"
            min="0.7"
            max="1.3"
            step="0.05"
            value={voiceRate}
            onChange={(e) => onVoiceRateChange(Number(e.target.value))}
            className="w-full accent-brand-500"
          />
        </div>
      </div>

      <div className="mt-auto space-y-2">
        {memoryInfo && (
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                memoryInfo.active === "dynamodb"
                  ? "bg-emerald-500"
                  : "bg-slate-400"
              }`}
            />
            <span className="font-semibold">
              {memoryInfo.active === "dynamodb"
                ? `Memory · DynamoDB (${memoryInfo.table ?? "lensassist-memory"})`
                : memoryInfo.active === "json-fallback"
                  ? "Memory · JSON (DDB fallback)"
                  : "Memory · Local JSON"}
            </span>
          </div>
        )}
        <button
          onClick={onResetMemory}
          className="w-full text-sm text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-lg py-2 transition-colors"
        >
          🗑️ Reset this conversation
        </button>
      </div>
    </aside>
  );
}
