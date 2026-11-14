import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-sidebar p-12 lg:flex lg:flex-col lg:justify-between">
        <Logo />
        <div className="relative z-10 max-w-md">
          <p className="text-[34px] font-semibold leading-[1.1] tracking-tight text-sidebar-ink">
            Cada ponto no lugar certo, com o valor que ele realmente tem.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-sidebar-muted">
            Saldos por programa, validade de cada lote, cartões e calculadoras de milheiro em um só painel.
          </p>
        </div>
        <p className="relative z-10 text-xs text-sidebar-muted">
          Não pedimos nem armazenamos senhas de bancos ou de programas de fidelidade.
        </p>
        <svg
          aria-hidden
          className="pointer-events-none absolute -right-24 top-1/2 h-[560px] w-[560px] -translate-y-1/2 opacity-[0.16]"
          viewBox="0 0 400 400"
          fill="none"
        >
          {[60, 100, 140, 180].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} stroke="#8fb0ff" strokeWidth="1" />
          ))}
          <path d="M40 260 C 140 120, 260 120, 360 200" stroke="#8fb0ff" strokeWidth="1.5" strokeDasharray="2 6" />
          <circle cx="360" cy="200" r="5" fill="#8fb0ff" />
          <circle cx="40" cy="260" r="5" fill="#8fb0ff" />
        </svg>
      </div>
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="lg:hidden">
            <Logo dark={false} />
          </div>
          <ThemeToggle />
        </div>
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</main>
      </div>
    </div>
  );
}
