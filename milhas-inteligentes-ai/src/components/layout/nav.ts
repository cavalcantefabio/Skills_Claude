import {
  Bell,
  Bot,
  Calculator,
  CreditCard,
  LayoutDashboard,
  Map,
  PlaneTakeoff,
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
  { href: "/voos", label: "Alertas de Voos", icon: PlaneTakeoff },
  { href: "/radar", label: "Radar de Oportunidades", icon: Radar },
  { href: "/calculadoras", label: "Calculadoras", icon: Calculator },
  { href: "/viagens", label: "Minhas Viagens", icon: Map },
  { href: "/agente", label: "Agente Inteligente", icon: Bot },
  { href: "/alertas", label: "Alertas", icon: Bell, status: "parcial" },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];
