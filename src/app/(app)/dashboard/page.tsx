"use client";

// Home dashboard: KPI cards, approval routing table, and primary actions.
// All data flows through React Query -> src/lib/data.

import { useSession } from "@/lib/auth/mock-session";
import { Badge } from "@/components/ui/badge";
import { KpiSection } from "@/components/dashboard/kpi-section";
import { RoutingTable } from "@/components/dashboard/routing-table";
import { ActionButtons } from "@/components/dashboard/action-buttons";

export default function DashboardPage() {
  const { user, role } = useSession();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, <span className="font-medium">{user.name}</span>
          <Badge variant="secondary" className="ml-2 align-middle">
            {role}
          </Badge>
        </p>
      </header>

      <KpiSection userId={user.id} />
      <RoutingTable userId={user.id} />
      <ActionButtons userId={user.id} />
    </div>
  );
}
