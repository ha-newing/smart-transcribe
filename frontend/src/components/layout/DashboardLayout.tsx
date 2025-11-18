import { ReactNode } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslation } from "react-i18next";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { t } = useTranslation();
  const { signOut } = useAuthActions();
  const currentUser = useQuery(api.users.current);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card p-4">
        <div className="mb-8">
          <h1 className="text-xl font-bold">{t("app.title")}</h1>
        </div>
        <nav className="space-y-2">
          <a
            href="/projects"
            className="block px-4 py-2 rounded-md hover:bg-accent"
          >
            {t("nav.projects")}
          </a>
          <a
            href="/transcribe"
            className="block px-4 py-2 rounded-md hover:bg-accent"
          >
            {t("nav.transcribe")}
          </a>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 border-b bg-card px-6 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {currentUser?.email}
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            {t("app.logout")}
          </Button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
