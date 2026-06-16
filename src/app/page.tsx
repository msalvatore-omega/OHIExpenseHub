"use client";

// Minimal home dashboard. Primarily here to verify the full stack is wired:
// React Query -> data-access layer -> mock store, plus the mock session.

import { useQuery } from "@tanstack/react-query";

import { APP_NAME } from "@/lib/constants";
import { getKpis, getReports } from "@/lib/data";
import { useSession } from "@/lib/auth/mock-session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const currency = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export default function Home() {
  const { user, role } = useSession();

  const kpis = useQuery({ queryKey: ["kpis"], queryFn: getKpis });
  const reports = useQuery({
    queryKey: ["reports"],
    queryFn: () => getReports(),
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{user.name}</span>
          <Badge variant="secondary" className="ml-2 align-middle">
            {role}
          </Badge>
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {kpis.isLoading || !kpis.data ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))
        ) : (
          <>
            <KpiCard label="Total reports" value={String(kpis.data.totalReports)} />
            <KpiCard
              label="Pending approval"
              value={String(kpis.data.pendingApprovalCount)}
            />
            <KpiCard
              label="Submitted total"
              value={currency(kpis.data.totalSubmittedAmount)}
            />
            <KpiCard
              label="Reimbursed (paid)"
              value={currency(kpis.data.totalReimbursedAmount)}
            />
          </>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Recent reports
        </h2>
        <div className="flex flex-col gap-2">
          {reports.isLoading || !reports.data
            ? Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-lg" />
              ))
            : reports.data.slice(0, 6).map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{r.reportName}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.periodFrom} → {r.periodTo}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular-nums">
                        {currency(r.totalAmount)}
                      </span>
                      <Badge variant="outline">{r.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </section>
    </main>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0" />
    </Card>
  );
}
