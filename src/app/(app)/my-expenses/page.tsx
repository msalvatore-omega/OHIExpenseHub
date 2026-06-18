"use client";

// My Expenses — the current user's own reports, filterable by status.

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { deleteReport, getMyReports } from "@/lib/data";
import { deletedReportMessage } from "@/lib/notify";
import { useSession } from "@/lib/auth/mock-session";
import { dashboardKeys } from "@/components/dashboard/use-dashboard-data";
import type { ExpenseReport, ReportStatus } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "ACCOUNTING_REVIEW",
  "EXECUTIVE_REVIEW",
  "APPROVED",
  "REJECTED",
  "PAID",
];

export default function MyExpensesPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const [filter, setFilter] = React.useState<ReportStatus | "ALL">("ALL");
  const [deleting, setDeleting] = React.useState<ExpenseReport | null>(null);

  const reportsQuery = useQuery({
    queryKey: ["dashboard", "my-reports", user.id],
    queryFn: () => getMyReports(user.id),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReport(id, user.id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["dashboard", "my-reports", user.id],
      });
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      // Returned receipts reappear in the gallery's Unattached list.
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      toast.success(deletedReportMessage(result.receiptsReturned));
      setDeleting(null);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not delete report"),
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
        <Button nativeButton={false} render={<Link href="/reports/new" />}>
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
              <TableHead className="text-right">Actions</TableHead>
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
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        nativeButton={false}
                        render={
                          <Link
                            href={
                              r.status === "DRAFT"
                                ? `/reports/${r.id}/edit`
                                : `/reports/${r.id}/view`
                            }
                          />
                        }
                      >
                        Open
                      </Button>
                      {r.status === "DRAFT" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleting(r)}
                          aria-label={`Delete ${r.reportName}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DeleteDraftDialog
        report={deleting}
        pending={deleteMutation.isPending}
        onCancel={() => !deleteMutation.isPending && setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

function DeleteDraftDialog({
  report,
  pending,
  onCancel,
  onConfirm,
}: {
  report: ExpenseReport | null;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!report} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete draft report?</DialogTitle>
          <DialogDescription>
            &ldquo;{report?.reportName}&rdquo; will be permanently deleted. Any
            receipts attached to it are returned to your Receipt Gallery (not
            deleted), where you can reuse them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Delete report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
