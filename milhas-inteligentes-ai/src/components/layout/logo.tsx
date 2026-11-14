export function Logo({ compact = false, dark = true }: { compact?: boolean; dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 place-items-center rounded-[10px] bg-[#1d4fd8] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
        <svg viewBox="0 0 32 32" className="size-5" aria-hidden>
          <path d="M5 19.5 27 7l-6.7 18.3-3.9-6.8L5 19.5Z" fill="#fff" />
          <path d="m16.4 18.5 3.9 6.8 1.7-4.7-5.6-2.1Z" fill="#c9d8ff" />
        </svg>
      </span>
      <span className={dark ? "text-sidebar-ink" : "text-ink"}>
        <span className="block text-[13px] font-semibold leading-tight tracking-tight">MILHAS INTELIGENTES</span>
        {!compact && (
          <span className={dark ? "text-[11px] text-sidebar-muted" : "text-[11px] text-muted"}>AI · gestão de pontos</span>
        )}
        {compact && <span className="sr-only">AI</span>}
      </span>
    </div>
  );
}
