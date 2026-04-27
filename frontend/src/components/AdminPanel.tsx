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
const PAGE_SIZE = 10;

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
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

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

  const remove = () => {
    if (!selected) return;
    setConfirmDelete(selected);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.adminDeletePolicy(confirmDelete);
      setSelected(null);
      setEditName("");
      setEditBody("");
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  };

  const filtered = policies.filter((p) =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
    <ConfirmDialog
      open={!!confirmDelete}
      title="Delete policy"
      message={`Permanently delete the policy "${confirmDelete}"? The agent will no longer cite this content. This affects every customer chat going forward.`}
      busy={busy}
      onConfirm={doDelete}
      onCancel={() => setConfirmDelete(null)}
    />
    <div className="grid grid-cols-3 gap-4 h-full">
      {/* Sidebar list */}
      <div className="col-span-1 border border-slate-200 rounded-lg p-3 flex flex-col">
        <button
          onClick={newPolicy}
          className="w-full bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold py-2 rounded-md mb-2"
        >
          + New policy
        </button>
        <input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
          placeholder="Search policies…"
          className="w-full mb-3 px-3 py-1.5 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="space-y-1 flex-1 overflow-y-auto chat-scroll">
          {visible.map((p) => (
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
          {visible.length === 0 && (
            <div className="text-xs text-slate-400 italic px-2 py-1">
              No policies match "{filter}"
            </div>
          )}
        </div>
        <Pagination
          page={safePage}
          pageSize={PAGE_SIZE}
          total={filtered.length}
          onPageChange={setPage}
        />
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
    </>
  );
}

// ─── Cases tab ────────────────────────────────────────────────────────
function CasesTab({ customers }: { customers: Record<string, Customer> }) {
  const [cases, setCases] = useState<Case[]>([]);
  const [editing, setEditing] = useState<Case | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<Case | null>(null);

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

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.adminDeleteCase(confirmDelete.case_id);
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setConfirmDelete(null);
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

  const filtered = cases.filter((c) => {
    const q = filter.toLowerCase();
    if (!q) return true;
    const cust = customers[c.customer_id];
    return (
      c.case_id.toLowerCase().includes(q) ||
      c.subject.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q) ||
      c.priority.toLowerCase().includes(q) ||
      (cust?.name ?? "").toLowerCase().includes(q)
    );
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
    <ConfirmDialog
      open={!!confirmDelete}
      title="Delete case"
      message={
        confirmDelete
          ? `Permanently delete case ${confirmDelete.case_id} ("${confirmDelete.subject}")? Customer: ${customers[confirmDelete.customer_id]?.name ?? confirmDelete.customer_id}.`
          : ""
      }
      busy={busy}
      onConfirm={doDelete}
      onCancel={() => setConfirmDelete(null)}
    />
    <div>
      <div className="flex items-center justify-between mb-3 gap-3">
        <input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
          placeholder="Search cases by ID, subject, customer, status…"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          onClick={() => setEditing(blank)}
          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap"
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
            {visible.map((c) => (
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
                      setConfirmDelete(c);
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400 italic">
                  No cases match "{filter}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={safePage}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onPageChange={setPage}
      />
    </div>
    </>
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
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<Customer | null>(null);

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

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.adminDeleteCustomer(confirmDelete.customer_id);
      onChanged();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      setConfirmDelete(null);
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

  const filtered = Object.values(customers).filter((c) => {
    const q = filter.toLowerCase();
    if (!q) return true;
    return (
      c.customer_id.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.city.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <>
    <ConfirmDialog
      open={!!confirmDelete}
      title="Delete customer"
      message={
        confirmDelete
          ? `Permanently delete ${confirmDelete.name} (${confirmDelete.customer_id})? This also wipes all their conversation memory and remembered facts from DynamoDB.`
          : ""
      }
      busy={busy}
      onConfirm={doDelete}
      onCancel={() => setConfirmDelete(null)}
    />
    <div>
      <div className="flex items-center gap-3 mb-3">
        <input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, phone, email, city…"
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <div className="text-xs text-slate-400 whitespace-nowrap">
          {filtered.length} of {Object.keys(customers).length} customers
        </div>
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
            {visible.map((c) => (
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
                      setConfirmDelete(c);
                    }}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400 italic">
                  No customers match "{filter}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        page={safePage}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onPageChange={setPage}
      />
    </div>
    </>
  );
}

// ─── Confirm dialog ──────────────────────────────────────────────────
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-pop max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-full grid place-items-center text-2xl ${
              destructive ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
            }`}
          >
            {destructive ? "⚠️" : "❓"}
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-brand-900">{title}</div>
            <div className="text-sm text-slate-600 mt-1 leading-relaxed">
              {message}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="text-sm font-semibold text-slate-700 hover:text-brand-900 px-4 py-2 rounded-lg border border-slate-200 hover:border-slate-300"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`text-sm font-semibold text-white px-4 py-2 rounded-lg disabled:opacity-50 ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-brand-500 hover:bg-brand-600"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pagination helper ───────────────────────────────────────────────
function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
      <div>
        Showing {from}–{to} of {total}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-md border border-slate-200 hover:border-brand-500 hover:text-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <div className="font-medium">
          Page {page} of {totalPages}
        </div>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 rounded-md border border-slate-200 hover:border-brand-500 hover:text-brand-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next →
        </button>
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
