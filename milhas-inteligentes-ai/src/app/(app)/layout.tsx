import { requireUser } from "@/server/auth/session";
import { logout } from "@/server/auth/actions";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <div className="min-h-dvh">
      <Sidebar userName={user.name} email={user.email} logout={logout} />
      <div className="lg:pl-[264px]">
        <div className="mx-auto flex max-w-[1320px] justify-end px-4 pt-4 sm:px-8 lg:pt-6">
          <ThemeToggle />
        </div>
        <main className="mx-auto max-w-[1320px] px-4 pb-16 pt-2 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
