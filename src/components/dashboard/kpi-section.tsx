"use client";

// The four KPI cards. Each card face is a Dialog trigger; the dialog body holds
// the drill-down (lists, approve/reject actions, or the paid-YTD chart + table).

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { BRAND_BLUE } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { approveReport, deleteReport, rejectReport } from "@/lib/data";
import type { ExpenseReport, ReportRoutingRow } from "@/lib/types";
import {
  useApprovalQueue,
  useInvalidateDashboard,
  useMyReports,
} from "@/components/dashboard/use-dashboard-data";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function KpiSection({ userId }: { userId: string }) {
  const myReports = useMyReports(userId);
  const queue = useApprovalQueue(userId);
  const invalidate = useInvalidateDashboard();

  const reports = myReports.data ?? [];
  const drafts = reports.filter((r) => r.status === "DRAFT");
  const inApproval = reports.filter(
    (r) => r.status === "SUBMITTED" || r.status === "IN_REVIEW"
  );
  const awaiting = queue.data ?? [];

  const currentYear = new Date().getFullYear();
  const paidYtd = reports.filter(
    (r) =>
      r.status === "PAID" &&
      new Date(r.updatedAt).getFullYear() === currentYear
  );
  const paidTotal = paidYtd.reduce((sum, r) => sum + r.totalAmount, 0);

  // ---- mutations ----
  const onMutationError = (err: unknown) =>
    toast.error(err instanceof Error ? err.message : "Something went wrong");

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: () => {
      invalidate();
      toast.success("Draft deleted");
    },
    onError: onMutationError,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveReport(id),
    onSuccess: () => {
      invalidate();
      toast.success("Report approved");
    },
    onError: onMutationError,
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => rejectReport(id),
    onSuccess: () => {
      invalidate();
      toast.success("Report rejected");
    },
    onError: onMutationError,
  });

  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {/* 1. Draft Reports */}
      <KpiCard
        label="Draft Reports"
        value={String(drafts.length)}
        loading={myReports.isLoading}
      >
        <DraftsBody
          loading={myReports.isLoading}
          drafts={drafts}
          onDelete={(id) => deleteMutation.mutate(id)}
          deletingId={
            deleteMutation.isPending
              ? (deleteMutation.variables as string)
              : null
          }
        />
      </KpiCard>

      {/* 2. In Approval */}
      <KpiCard
        label="In Approval"
        value={String(inApproval.length)}
        loading={myReports.isLoading}
      >
        <ReportListBody loading={myReports.isLoading} reports={inApproval} />
      </KpiCard>

      {/* 3. Awaiting Me */}
      <KpiCard
        label="Awaiting Me"
        value={String(awaiting.length)}
        loading={queue.isLoading}
      >
        <AwaitingBody
          loading={queue.isLoading}
          rows={awaiting}
          onApprove={(id) => approveMutation.mutate(id)}
          onReject={(id) => rejectMutation.mutate(id)}
          busy={approveMutation.isPending || rejectMutation.isPending}
        />
      </KpiCard>

      {/* 4. Total Paid YTD */}
      <KpiCard
        label="Total Paid YTD"
        value={formatCurrency(paidTotal)}
        loading={myReports.isLoading}
        dialogClassName="sm:max-w-2xl"
      >
        <PaidYtdBody
          loading={myReports.isLoading}
          reports={paidYtd}
          total={paidTotal}
          year={currentYear}
        />
      </KpiCard>
    </section>
  );
}

// ---------------- Card shell ----------------

function KpiCard({
  label,
  value,
  loading,
  dialogClassName,
  children,
}: {
  label: string;
  value: string;
  loading: boolean;
  dialogClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        }
      >
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        {loading ? (
          <Skeleton className="mt-1 h-8 w-24" />
        ) : (
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
        )}
      </DialogTrigger>
      <DialogContent className={cn("sm:max-w-lg", dialogClassName)}>
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Shared bits ----------------

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

// ---------------- Body: Drafts (Edit / Delete) ----------------

function DraftsBody({
  loading,
  drafts,
  onDelete,
  deletingId,
}: {
  loading: boolean;
  drafts: ExpenseReport[];
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const router = useRouter();

  if (loading) return <RowsSkeleton />;
  if (drafts.length === 0) return <EmptyState message="No draft reports." />;

  return (
    <ul className="flex flex-col gap-2">
      {drafts.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{r.reportName}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(r.totalAmount)}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/reports/${r.id}/edit`)}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={deletingId === r.id}
              onClick={() => {
                if (
                  window.confirm(`Delete draft "${r.reportName}"?`)
                ) {
                  onDelete(r.id);
                }
              }}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------- Body: report list with pills ----------------

function ReportListBody({
  loading,
  reports,
}: {
  loading: boolean;
  reports: ExpenseReport[];
}) {
  if (loading) return <RowsSkeleton />;
  if (reports.length === 0)
    return <EmptyState message="Nothing in approval." />;

  return (
    <ul className="flex flex-col gap-2">
      {reports.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{r.reportName}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatCurrency(r.totalAmount)}
            </p>
          </div>
          <StatusPill status={r.status} />
        </li>
      ))}
    </ul>
  );
}

// ---------------- Body: Awaiting Me (Approve / Reject) ----------------

function AwaitingBody({
  loading,
  rows,
  onApprove,
  onReject,
  busy,
}: {
  loading: boolean;
  rows: ReportRoutingRow[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  busy: boolean;
}) {
  if (loading) return <RowsSkeleton />;
  if (rows.length === 0)
    return <EmptyState message="No reports awaiting your action." />;

  return (
    <ul className="flex flex-col gap-2">
      {rows.map(({ report, submitterName }) => (
        <li
          key={report.id}
          className="flex flex-col gap-2 rounded-lg border border-border p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {report.reportName}
              </p>
              <p className="text-xs text-muted-foreground">
                {submitterName} · {formatCurrency(report.totalAmount)}
              </p>
            </div>
            <StatusPill status={report.status} />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-green-600 text-white hover:bg-green-700"
              disabled={busy}
              onClick={() => onApprove(report.id)}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950"
              disabled={busy}
              onClick={() => onReject(report.id)}
            >
              Reject
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------- Body: Paid YTD (chart + table) ----------------

function PaidYtdBody({
  loading,
  reports,
  total,
  year,
}: {
  loading: boolean;
  reports: ExpenseReport[];
  total: number;
  year: number;
}) {
  const monthly = React.useMemo(() => {
    const series = MONTHS.map((month) => ({ month, total: 0 }));
    for (const r of reports) {
      series[new Date(r.updatedAt).getMonth()].total += r.totalAmount;
    }
    return series;
  }, [reports]);

  if (loading) return <RowsSkeleton rows={4} />;
  if (reports.length === 0)
    return <EmptyState message={`No payments in ${year}.`} />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {formatCurrency(total)} paid across {reports.length}{" "}
        {reports.length === 1 ? "report" : "reports"} in {year}.
      </p>

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="month"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={52}
              tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              labelClassName="text-foreground"
              contentStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="total" fill={BRAND_BLUE} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Report</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{r.reportName}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(r.updatedAt)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(r.totalAmount)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
