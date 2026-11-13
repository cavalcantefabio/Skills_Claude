import {
  Bell,
  Bot,
  Calculator,
  CreditCard,
  LayoutDashboard,
  Map,
  Plane,
  Radar,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; status?: "dev" | "parcial" };

export const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cartoes", label: "Meus Cartões", icon: CreditCard },
  { href: "/programas", label: "Programas de Fidelidade", icon: Wallet },
  { href: "/milhas", label: "Minhas Milhas", icon: Plane },
  { href: "/radar", label: "Radar de Oportunidades", icon: Radar, status: "dev" },
  { href: "/calculadoras", label: "Calculadoras", icon: Calculator },
  { href: "/viagens", label: "Planejador de Viagens", icon: Map, status: "parcial" },
  { href: "/agente", label: "Agente Inteligente", icon: Bot, status: "dev" },
  { href: "/alertas", label: "Alertas", icon: Bell, status: "parcial" },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
