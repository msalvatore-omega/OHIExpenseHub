"use client";

// My Expenses — the current user's own reports, filterable by status.

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { getMyReports } from "@/lib/data";
import { useSession } from "@/lib/auth/mock-session";
import type { ReportStatus } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUSES: ReportStatus[] = [
  "DRAFT", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED", "PAID",
];

export default function MyExpensesPage() {
  const { user } = useSession();
  const [filter, setFilter] = React.useState<ReportStatus | "ALL">("ALL");

  const reportsQuery = useQuery({
    queryKey: ["dashboard", "my-reports", user.id],
    queryFn: () => getMyReports(user.id),
  });

  const reports = React.useMemo(
    () => reportsQuery.data ?? [],
    [reportsQuery.data]
  );
  const counts = React.useMemo(() => {
    const m = new Map<ReportStatus, number>();
    for (const r of reports) m.set(r.status, (m.get(r.status) ?? 0) + 1);
    return m;
  }, [reports]);

  const visible =
    filter === "ALL" ? reports : reports.filter((r) => r.status === filter);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>My Expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your expense reports and their statuses.
          </p>
        </div>
        <Button render={<Link href="/reports/new" />}>
          <FilePlus2 className="size-4" />
          New Expense
        </Button>
      </header>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")}>
          All ({reports.length})
        </FilterChip>
        {STATUSES.map((s) => (
          <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
            {s} ({counts.get(s) ?? 0})
          </FilterChip>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report Name</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Open</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportsQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {reports.length === 0
                    ? "You have no expense reports yet."
                    : "No reports with this status."}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.reportName}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(r.periodFrom)} – {formatDate(r.periodTo)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(r.totalAmount)}
                  </TableCell>
                  <TableCell>
                    <StatusPill status={r.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/reports/${r.id}/edit`} />}
                    >
                      Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}
