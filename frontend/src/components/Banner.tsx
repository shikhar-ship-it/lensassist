export function Banner() {
  return (
    <div className="bg-gradient-to-br from-brand-900 to-brand-500 text-white rounded-2xl px-6 py-4 shadow-soft flex items-center gap-4">
      <div className="text-3xl bg-white/15 w-14 h-14 rounded-xl flex items-center justify-center backdrop-blur">
        👓
      </div>
      <div>
        <div className="text-xl font-bold tracking-tight">LensAssist</div>
        <div className="text-sm opacity-85">
          Unified Post-Sales AI Concierge · Returns · Warranty · Lens · Orders · Membership
        </div>
      </div>
    </div>
  );
}
