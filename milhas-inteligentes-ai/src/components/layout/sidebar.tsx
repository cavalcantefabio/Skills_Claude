"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
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

type SidebarProps = { userName: string; email: string; logout: () => Promise<void> };

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

      {/* Barra superior no celular */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/8 bg-sidebar px-4 lg:hidden">
        <Logo compact />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="grid size-9 place-items-center rounded-lg text-sidebar-ink hover:bg-sidebar-active"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-sidebar shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute right-3 top-4 grid size-9 place-items-center rounded-lg text-sidebar-ink hover:bg-sidebar-active"
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
