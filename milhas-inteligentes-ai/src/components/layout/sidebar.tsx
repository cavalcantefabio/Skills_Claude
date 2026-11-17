"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bot, LayoutDashboard, LogOut, MoreHorizontal, PlaneTakeoff, Radar, X } from "lucide-react";
import { NAV } from "./nav";
import { Logo } from "./logo";
import { cx } from "@/components/ui";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon, status }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition-colors",
              active
                ? "bg-sidebar-active font-medium text-sidebar-ink"
                : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-ink",
            )}
          >
            <Icon className={cx("size-[18px] shrink-0", active ? "text-[#8fb0ff]" : "")} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {status === "dev" && (
              <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] font-medium text-sidebar-muted">
                Em breve
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ userName, email, logout, onNavigate }: SidebarProps & { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col px-3 py-5">
      <div className="px-3 pb-6">
        <Logo />
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavList onNavigate={onNavigate} />
      </div>
      <div className="mt-4 border-t border-white/8 px-3 pt-4">
        <p className="truncate text-[13px] font-medium text-sidebar-ink">{userName}</p>
        <p className="truncate text-xs text-sidebar-muted">{email}</p>
        <form action={logout} className="mt-3">
          <button
            type="submit"
            className="flex items-center gap-2 text-xs text-sidebar-muted transition-colors hover:text-sidebar-ink"
          >
            <LogOut className="size-3.5" aria-hidden /> Sair
          </button>
        </form>
      </div>
    </div>
  );
}

type SidebarProps = { userName: string; email: string; logout: () => Promise<void>; unseenFlights?: number };

/** Abas fixas no celular; o resto do menu fica em "Mais". */
const TABS = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/voos", label: "Voos", icon: PlaneTakeoff },
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/agente", label: "Agente", icon: Bot },
] as const;

function TabBar({ onMore, moreOpen, unseenFlights = 0 }: { onMore: () => void; moreOpen: boolean; unseenFlights?: number }) {
  const pathname = usePathname();
  const inTabs = TABS.some((t) => isActive(pathname, t.href));
  const item = "flex min-w-0 flex-1 flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-medium transition-colors";
  return (
    <nav
      aria-label="Abas"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/8 bg-sidebar/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto flex max-w-lg">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const badge = href === "/voos" && !active && unseenFlights > 0 ? unseenFlights : 0;
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cx(item, active ? "text-[#8fb0ff]" : "text-sidebar-muted hover:text-sidebar-ink")}>
              <span className="relative">
                <Icon className="size-6" aria-hidden />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] rounded-full bg-[#f04f43] px-1 text-center text-[10px] leading-[18px] font-semibold text-white">
                    {badge > 99 ? "99+" : badge}
                    <span className="sr-only"> voos novos para os seus avisos</span>
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          aria-expanded={moreOpen}
          className={cx(item, !inTabs || moreOpen ? "text-[#8fb0ff]" : "text-sidebar-muted hover:text-sidebar-ink")}
        >
          <MoreHorizontal className="size-6" aria-hidden />
          Mais
        </button>
      </div>
    </nav>
  );
}

export function Sidebar(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
  }, [open]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] bg-sidebar lg:block">
        <SidebarContent {...props} />
      </aside>

      {/* Barra superior no celular (respeita o entalhe do iPhone no app instalado) */}
      <div className="sticky top-0 z-30 border-b border-white/8 bg-sidebar pt-[env(safe-area-inset-top)] lg:hidden">
        <div className="flex h-14 items-center px-4">
          <Logo compact />
        </div>
      </div>

      <TabBar onMore={() => setOpen(true)} moreOpen={open} unseenFlights={props.unseenFlights} />

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-[calc(env(safe-area-inset-top)+1rem)] grid size-9 place-items-center rounded-lg text-sidebar-ink hover:bg-sidebar-active"
            >
              <X className="size-5" aria-hidden />
            </button>
            <SidebarContent key={pathname} {...props} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
