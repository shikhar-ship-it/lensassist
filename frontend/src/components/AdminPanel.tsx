import { useEffect, useState } from "react";
import { api } from "../api";
import type { Case, Customer } from "../types";

interface Props {
  customers: Record<string, Customer>;
  onClose: () => void;
  onCustomersChanged: () => void;
}

type Tab = "policies" | "cases" | "customers";

export function AdminPanel({ customers, onClose, onCustomersChanged }: Props) {
  const [tab, setTab] = useState<Tab>("policies");

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-stretch justify-end">
      <div className="bg-white w-full max-w-4xl h-full overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-lg font-bold text-brand-900">⚙️ Admin Panel</div>
            <div className="text-xs text-slate-500">
              Manage policies, cases, and customers — changes apply live
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-6">
          <div className="flex gap-1">
            {(["policies", "cases", "customers"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-semibold capitalize transition-colors ${
                  tab === t
                    ? "border-b-2 border-brand-500 text-brand-500"
                    : "text-slate-500 hover:text-brand-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto chat-scroll p-6">
          {tab === "policies" && <PoliciesTab />}
          {tab === "cases" && <CasesTab customers={customers} />}
          {tab === "customers" && (
            <CustomersTab
              customers={customers}
              onChanged={onCustomersChanged}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Policies tab ──────────────────────────────────────────────────────
function PoliciesTab() {
  const [policies, setPolicies] = useState<
    { name: string; body: string; path: string }[]
  >([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const load = () => {
    api
      .adminListPolicies()
      .then((data) => {
        setPolicies(data);
        if (data.length && !selected) {
          setSelected(data[0].name);
          setEditName(data[0].name);
          setEditBody(data[0].body);
        }
      })
      .catch((e) => setError(String(e)));
  };
  useEffect(() => {
    load();
  }, []);

  const pick = (name: string) => {
    const p = policies.find((x) => x.name === name);
    if (!p) return;
    setSelected(name);
    setEditName(p.name);
    setEditBody(p.body);
    setStatus(null);
    setError(null);
  };

  const newPolicy = () => {
    setSelected(null);
    setEditName("");
    setEditBody("# New policy\n\n");
    setStatus(null);
    setError(null);
  };

  const save = async () => {
    if (!editName.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.adminSavePolicy(selected || editName, editName.trim(), editBody);
      setStatus(`Saved · agent will use the new content on the next reply`);
      load();
      setSelected(editName.trim());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    if (!confirm(`Delete policy "${selected}"?`)) return;
    setBusy(true);
    try {
      await api.adminDeletePolicy(selected);
      setSelected(null);
      setEditName("");
      setEditBody("");
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-4 h-full">
      {/* Sidebar list */}
      <div className="col-span-1 border border-slate-200 rounded-lg p-3 overflow-y-auto chat-scroll">
        <button
          onClick={newPolicy}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold py-2 rounded-md mb-3"
        >
          + New policy
        </button>
        <div className="space-y-1">
          {policies.map((p) => (
            <button
              key={p.name}
              onClick={() => pick(p.name)}
              className={`w-full text-left text-sm px-2 py-1.5 rounded ${
                selected === p.name
                  ? "bg-brand-50 text-brand-900 font-semibold"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              📄 {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="col-span-2 flex flex-col gap-3">
        <input
          value={editName}
          onChange={(e) => setEditName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "_"))}
          placeholder="filename (e.g. warranty)"
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
        />
        <textarea
          value={editBody}
          onChange={(e) => setEditBody(e.target.value)}
          spellCheck={false}
          className="flex-1 min-h-[400px] px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
        {status && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2 rounded-lg">
            ✓ {status}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-slate-400">
            Edits are written to disk and the RAG cache reloads instantly.
          </div>
          <div className="flex gap-2">
            {selected && (
              <button
                onClick={remove}
                disabled={busy}
                className="text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg px-3 py-2 disabled:opacity-50"
              >
                Delete
              </button>
            )}
            <button
              onClick={save}
              disabled={busy || !editName.trim()}
              className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {busy ? "Saving…" : "Save policy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Cases tab ────────────────────────────────────────────────────────
function CasesTab({ customers }: { customers: Record<string, Customer> }) {
  const [cases, setCases] = useState<Case[]>([]);
  const [editing, setEditing] = useState<Case | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    api
      .adminListCases()
      .then(setCases)
      .catch((e) => setError(String(e)));

  useEffect(() => {
    load();
  }, []);

  const blank: Case = {
    case_id: "",
    customer_id: Object.keys(customers)[0] ?? "",
    order_id: "",
    subject: "",
    status: "Open",
    priority: "Medium",
    created: "",
    last_update: "",
    channel: "App",
    product: "",
    description: "",
    messages: [],
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        case_id: editing.case_id,
        customer_id: editing.customer_id,
        order_id: editing.order_id,
        subject: editing.subject,
        status: editing.status,
        priority: editing.priority,
        channel: editing.channel,
        product: editing.product,
        description: editing.description,
      };
      const exists = cases.some((c) => c.case_id === editing.case_id);
      if (exists) {
        await api.adminUpdateCase(editing.case_id, payload);
      } else {
        await api.adminCreateCase(payload);
      }
      setEditing(null);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`Delete case ${id}?`)) return;
    await api.adminDeleteCase(id).catch((e) => setError(String(e)));
    load();
  };

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(null)}
            className="text-sm text-slate-500 hover:text-brand-500"
          >
            ← Back
          </button>
          <h3 className="text-base font-semibold text-brand-900">
            {editing.case_id ? `Edit ${editing.case_id}` : "New case"}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Case ID (blank to auto)"
            value={editing.case_id}
            onChange={(v) => setEditing({ ...editing, case_id: v })}
          />
          <SelectField
            label="Customer"
            value={editing.customer_id}
            options={Object.values(customers).map((c) => ({
              value: c.customer_id,
              label: `${c.customer_id} · ${c.name}`,
            }))}
            onChange={(v) => setEditing({ ...editing, customer_id: v })}
          />
          <Field
            label="Order ID"
            value={editing.order_id}
            onChange={(v) => setEditing({ ...editing, order_id: v })}
          />
          <Field
            label="Product"
            value={editing.product}
            onChange={(v) => setEditing({ ...editing, product: v })}
          />
          <SelectField
            label="Status"
            value={editing.status}
            options={["Open", "Resolved", "Escalated", "Awaiting Customer"].map(
              (v) => ({ value: v, label: v })
            )}
            onChange={(v) => setEditing({ ...editing, status: v })}
          />
          <SelectField
            label="Priority"
            value={editing.priority}
            options={["Low", "Medium", "High"].map((v) => ({
              value: v,
              label: v,
            }))}
            onChange={(v) => setEditing({ ...editing, priority: v })}
          />
          <SelectField
            label="Channel"
            value={editing.channel}
            options={["App", "WhatsApp", "Email", "Store Walk-in", "Phone"].map(
              (v) => ({ value: v, label: v })
            )}
            onChange={(v) => setEditing({ ...editing, channel: v })}
          />
          <Field
            label="Subject"
            value={editing.subject}
            onChange={(v) => setEditing({ ...editing, subject: v })}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Description
          </label>
          <textarea
            value={editing.description}
            onChange={(e) =>
              setEditing({ ...editing, description: e.target.value })
            }
            rows={4}
            className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setEditing(null)}
            className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy || !editing.subject.trim()}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {busy ? "Saving…" : "Save case"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-slate-500">
          {cases.length} cases · click any row to edit
        </div>
        <button
          onClick={() => setEditing(blank)}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          + New case
        </button>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-3">
          {error}
        </div>
      )}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">Case</th>
              <th className="text-left px-3 py-2">Customer</th>
              <th className="text-left px-3 py-2">Subject</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Priority</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr
                key={c.case_id}
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => setEditing(c)}
              >
                <td className="px-3 py-2 font-mono text-xs text-brand-500">
                  {c.case_id}
                </td>
                <td className="px-3 py-2">
                  {customers[c.customer_id]?.name ?? c.customer_id}
                </td>
                <td className="px-3 py-2 text-slate-700">{c.subject}</td>
                <td className="px-3 py-2 text-xs">{c.status}</td>
                <td className="px-3 py-2 text-xs">{c.priority}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(c.case_id);
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Customers tab ────────────────────────────────────────────────────
function CustomersTab({
  customers,
  onChanged,
}: {
  customers: Record<string, Customer>;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await api.adminUpdateCustomer(editing.customer_id, editing);
      setEditing(null);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(`Delete customer ${id} (and all their memory)?`)) return;
    setBusy(true);
    try {
      await api.adminDeleteCustomer(id);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(null)}
            className="text-sm text-slate-500 hover:text-brand-500"
          >
            ← Back
          </button>
          <h3 className="text-base font-semibold text-brand-900">
            Edit {editing.customer_id} · {editing.name}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Name"
            value={editing.name}
            onChange={(v) => setEditing({ ...editing, name: v })}
          />
          <Field
            label="Phone"
            value={editing.phone}
            onChange={(v) => setEditing({ ...editing, phone: v })}
          />
          <Field
            label="Email"
            value={editing.email}
            onChange={(v) => setEditing({ ...editing, email: v })}
          />
          <Field
            label="City"
            value={editing.city}
            onChange={(v) => setEditing({ ...editing, city: v })}
          />
          <Field
            label="Lifetime value (₹)"
            value={String(editing.lifetime_value)}
            onChange={(v) =>
              setEditing({ ...editing, lifetime_value: Number(v) || 0 })
            }
          />
          <SelectField
            label="Preferred language"
            value={editing.preferred_language}
            options={["English", "Hindi"].map((v) => ({ value: v, label: v }))}
            onChange={(v) => setEditing({ ...editing, preferred_language: v })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={editing.gold_member}
              onChange={(e) =>
                setEditing({ ...editing, gold_member: e.target.checked })
              }
            />
            Gold member
          </label>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setEditing(null)}
            className="text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-3 py-2"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            {busy ? "Saving…" : "Save customer"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-sm text-slate-500 mb-3">
        {Object.keys(customers).length} customers · click any row to edit
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-3">
          {error}
        </div>
      )}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="text-left px-3 py-2">ID</th>
              <th className="text-left px-3 py-2">Name</th>
              <th className="text-left px-3 py-2">Phone</th>
              <th className="text-left px-3 py-2">City</th>
              <th className="text-left px-3 py-2">Tier</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {Object.values(customers).map((c) => (
              <tr
                key={c.customer_id}
                className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                onClick={() => setEditing(c)}
              >
                <td className="px-3 py-2 font-mono text-xs text-brand-500">
                  {c.customer_id}
                </td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2 text-slate-500">{c.phone}</td>
                <td className="px-3 py-2 text-slate-500">{c.city}</td>
                <td className="px-3 py-2 text-xs">
                  {c.gold_member ? "⭐ Gold" : "Standard"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(c.customer_id);
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Small form helpers ──────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
