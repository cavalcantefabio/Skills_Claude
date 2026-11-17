import { requireUser } from "@/server/auth/session";
import { logout } from "@/server/auth/actions";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { unseenHitCount } from "@/server/services/flight-alerts";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const unseenFlights = await unseenHitCount(user.id);
  return (
    <div className="min-h-dvh">
      <Sidebar userName={user.name} email={user.email} logout={logout} unseenFlights={unseenFlights} />
      <div className="lg:pl-[264px]">
        <div className="mx-auto flex max-w-[1320px] justify-end px-4 pt-4 sm:px-8 lg:pt-6">
          <ThemeToggle />
        </div>
        <main className="mx-auto max-w-[1320px] px-4 pt-2 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-8 lg:pb-16">{children}</main>
      </div>
    </div>
  );
}
