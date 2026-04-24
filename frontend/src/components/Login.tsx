import { useState } from "react";
import { api } from "../api";
import type { AuthState } from "../auth";

interface Props {
  onLogin: (state: AuthState) => void;
}

export function Login({ onLogin }: Props) {
  const [mode, setMode] = useState<"customer" | "admin">("customer");

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-pop p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="text-3xl bg-brand-50 w-14 h-14 rounded-xl grid place-items-center">
            👓
          </div>
          <div>
            <div className="text-xl font-bold text-brand-900">LensAssist</div>
            <div className="text-sm text-slate-500">
              Post-Sales Concierge
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
          <button
            onClick={() => setMode("customer")}
            className={`text-sm font-semibold py-2 rounded-md transition-colors ${
              mode === "customer"
                ? "bg-white text-brand-900 shadow-sm"
                : "text-slate-500 hover:text-brand-900"
            }`}
          >
            Customer
          </button>
          <button
            onClick={() => setMode("admin")}
            className={`text-sm font-semibold py-2 rounded-md transition-colors ${
              mode === "admin"
                ? "bg-white text-brand-900 shadow-sm"
                : "text-slate-500 hover:text-brand-900"
            }`}
          >
            CX Agent / Admin
          </button>
        </div>

        {mode === "customer" ? (
          <CustomerLoginForm onLogin={onLogin} />
        ) : (
          <AdminLoginForm onLogin={onLogin} />
        )}
      </div>
    </div>
  );
}

function CustomerLoginForm({ onLogin }: { onLogin: (s: AuthState) => void }) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.requestOtp(phone);
      setHint(res.demo_hint);
      setStep("otp");
    } catch (err) {
      setError(
        String(err).includes("404")
          ? "No Lenskart account found for that phone number. Try 9876543210."
          : String(err)
      );
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.verifyOtp(phone, otp);
      onLogin({
        token: res.token,
        role: res.role,
        customer_id: res.customer_id,
        name: res.name,
      });
    } catch (err) {
      setError(
        String(err).includes("401")
          ? "Incorrect OTP. Demo OTP is 1234."
          : String(err)
      );
    } finally {
      setBusy(false);
    }
  };

  if (step === "phone") {
    return (
      <form onSubmit={requestOtp} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
            Mobile number
          </label>
          <input
            type="tel"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="9876543210"
            className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-[15px]"
          />
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={busy || !phone.trim()}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
        >
          {busy ? "Sending OTP…" : "Send OTP"}
        </button>
        <div className="text-xs text-slate-500 text-center">
          Demo accounts: try <span className="font-mono">9876543210</span> (Priya) ·{" "}
          <span className="font-mono">9000011111</span> (Rahul) ·{" "}
          <span className="font-mono">9811122334</span> (Arjun)
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={verifyOtp} className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          OTP sent to {phone}
        </label>
        <input
          type="text"
          autoFocus
          inputMode="numeric"
          maxLength={4}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="1234"
          className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-[20px] font-mono tracking-[0.4em] text-center"
        />
      </div>
      {hint && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg">
          💡 {hint}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || otp.length !== 4}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
      >
        {busy ? "Verifying…" : "Verify & sign in"}
      </button>
      <button
        type="button"
        onClick={() => {
          setStep("phone");
          setOtp("");
          setError(null);
        }}
        className="w-full text-sm text-slate-500 hover:text-brand-500"
      >
        ← Change mobile number
      </button>
    </form>
  );
}

function AdminLoginForm({ onLogin }: { onLogin: (s: AuthState) => void }) {
  const [email, setEmail] = useState("admin@lenskart.com");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.adminLogin(email, password);
      onLogin({
        token: res.token,
        role: res.role,
        customer_id: res.customer_id,
        name: res.name,
      });
    } catch (err) {
      setError(
        String(err).includes("401") ? "Invalid email or password" : String(err)
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Work email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-[15px]"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Password
        </label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="demo123"
          className="w-full mt-1 px-4 py-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-[15px]"
        />
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !password}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition-colors"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <div className="text-xs text-slate-500 text-center">
        Demo: <span className="font-mono">admin@lenskart.com</span> /{" "}
        <span className="font-mono">demo123</span>
      </div>
    </form>
  );
}
