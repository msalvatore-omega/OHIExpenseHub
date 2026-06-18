"use client";

// The four KPI cards. Each card face is a Dialog trigger; the dialog body holds
// the drill-down (lists, approve/reject actions, or the paid-YTD chart + table).

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Pencil, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { BRAND_BLUE, CHART_PALETTE } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  approveReport,
  deleteReport,
  getLedgerEntries,
  rejectReport,
} from "@/lib/data";
import { deletedReportMessage, toastQueuedNotifications } from "@/lib/notify";
import type { ExpenseReport, ReportRoutingRow } from "@/lib/types";
import {
  useApprovalQueue,
  useDraftRejectionIds,
  useInvalidateDashboard,
  useMyReports,
} from "@/components/dashboard/use-dashboard-data";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
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

const SEEN_KEY = "ohi-rejected-seen";

function readSeenIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids: Set<string>): void {
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function KpiSection({ userId }: { userId: string }) {
  const myReports = useMyReports(userId);
  const queue = useApprovalQueue(userId);
  const rejectionQuery = useDraftRejectionIds(userId);
  const invalidate = useInvalidateDashboard();

  // Per-session "seen" tracking: once the Drafts modal is opened, all currently-
  // rejected draft IDs are marked seen in sessionStorage so the badge clears.
  const [seenIds, setSeenIds] = React.useState<Set<string>>(readSeenIds);

  const reports = myReports.data ?? [];
  const drafts = reports.filter((r) => r.status === "DRAFT");
  const inApproval = reports.filter(
    (r) =>
      r.status === "SUBMITTED" ||
      r.status === "IN_REVIEW" ||
      r.status === "ACCOUNTING_REVIEW" ||
      r.status === "EXECUTIVE_REVIEW"
  );
  const awaiting = queue.data ?? [];

  const currentYear = new Date().getFullYear();
  const paidYtd = reports.filter(
    (r) =>
      r.status === "PAID" &&
      new Date(r.updatedAt).getFullYear() === currentYear
  );
  const paidTotal = paidYtd.reduce((sum, r) => sum + r.totalAmount, 0);
  const paidReports = reports.filter((r) => r.status === "PAID");

  const rejectedIds = rejectionQuery.data ?? new Set<string>();
  const unseenRejectedCount = [...rejectedIds].filter(
    (id) => !seenIds.has(id)
  ).length;

  const handleDraftsOpen = () => {
    const next = new Set(seenIds);
    for (const id of rejectedIds) next.add(id);
    setSeenIds(next);
    writeSeenIds(next);
  };

  // ---- mutations ----
  const onMutationError = (err: unknown) =>
    toast.error(err instanceof Error ? err.message : "Something went wrong");

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteReport(id, userId),
    onSuccess: (result) => {
      invalidate();
      toast.success(deletedReportMessage(result.receiptsReturned));
    },
    onError: onMutationError,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveReport(id, userId),
    onSuccess: (result) => {
      invalidate();
      toastQueuedNotifications(result.notifications);
    },
    onError: onMutationError,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      rejectReport(id, userId, note),
    onSuccess: (result) => {
      invalidate();
      toastQueuedNotifications(result.notifications);
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
        badge={unseenRejectedCount}
        onOpen={handleDraftsOpen}
      >
        <DraftsBody
          loading={myReports.isLoading}
          drafts={drafts}
          rejectedIds={rejectedIds}
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
          onReject={(id, note) => rejectMutation.mutate({ id, note })}
          busy={approveMutation.isPending || rejectMutation.isPending}
        />
      </KpiCard>

      {/* 4. Total Paid YTD */}
      <KpiCard
        label="Total Paid YTD"
        value={formatCurrency(paidTotal)}
        loading={myReports.isLoading}
        dialogClassName="sm:max-w-3xl"
      >
        <PaidYtdBody loading={myReports.isLoading} reports={paidReports} />
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
  badge,
  onOpen,
  children,
}: {
  label: string;
  value: string;
  loading: boolean;
  dialogClassName?: string;
  badge?: number;
  onOpen?: () => void;
  children: React.ReactNode;
}) {
  const hasAlert = Boolean(badge && badge > 0);
  return (
    <Dialog onOpenChange={(open) => { if (open && onOpen) onOpen(); }}>
      <DialogTrigger
        render={
          <button
            type="button"
            className={cn(
              "relative flex w-full flex-col items-start gap-1 rounded-xl border p-4 text-left shadow-sm transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              hasAlert
                ? "border-red-300 bg-card dark:border-red-800"
                : "border-border bg-card"
            )}
          />
        }
      >
        {hasAlert && (
          <span className="absolute right-2 top-2 flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[10px] font-bold leading-none text-white">
            {badge! > 99 ? "99+" : badge}
          </span>
        )}
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
  rejectedIds,
  onDelete,
  deletingId,
}: {
  loading: boolean;
  drafts: ExpenseReport[];
  rejectedIds: Set<string>;
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const router = useRouter();

  const sorted = React.useMemo(
    () =>
      [...drafts].sort((a, b) => {
        const ar = rejectedIds.has(a.id) ? 0 : 1;
        const br = rejectedIds.has(b.id) ? 0 : 1;
        return ar - br;
      }),
    [drafts, rejectedIds]
  );

  if (loading) return <RowsSkeleton />;
  if (sorted.length === 0) return <EmptyState message="No draft reports." />;

  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((r) => {
        const isRejected = rejectedIds.has(r.id);
        return (
          <li
            key={r.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border p-3",
              isRejected
                ? "border-red-200 dark:border-red-900"
                : "border-border"
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{r.reportName}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatCurrency(r.totalAmount)}
                </p>
                {isRejected && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/60 dark:text-red-400">
                    Rejected — needs revision
                  </span>
                )}
              </div>
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
                  if (window.confirm(`Delete draft "${r.reportName}"?`)) {
                    onDelete(r.id);
                  }
                }}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </li>
        );
      })}
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
  const router = useRouter();

  if (loading) return <RowsSkeleton />;
  if (reports.length === 0)
    return <EmptyState message="Nothing in approval." />;

  return (
    <ul className="flex flex-col gap-2">
      {reports.map((r) => (
        <li
          key={r.id}
          role="button"
          tabIndex={0}
          className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => router.push(`/reports/${r.id}/view`)}
          onKeyDown={(e) =>
            e.key === "Enter" && router.push(`/reports/${r.id}/view`)
          }
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
  onReject: (id: string, note: string) => void;
  busy: boolean;
}) {
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [rejectNote, setRejectNote] = React.useState("");

  const handleRejectConfirm = () => {
    if (!rejectingId || !rejectNote.trim()) return;
    onReject(rejectingId, rejectNote.trim());
    setRejectingId(null);
    setRejectNote("");
  };

  if (loading) return <RowsSkeleton />;
  if (rows.length === 0)
    return <EmptyState message="No reports awaiting your action." />;

  return (
    <>
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
                onClick={() => setRejectingId(report.id)}
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={rejectingId !== null}
        onOpenChange={(o) => {
          if (busy) return;
          if (!o) { setRejectingId(null); setRejectNote(""); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject report</DialogTitle>
            <DialogDescription>
              The report will be returned to the employee&apos;s drafts.
              Resubmitting restarts approval from the first approver.
              A reason is required.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection…"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            rows={3}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => { setRejectingId(null); setRejectNote(""); }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || rejectNote.trim().length === 0}
              onClick={handleRejectConfirm}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <XCircle className="size-4" />
              )}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------- Body: Paid YTD (charts + table) ----------------

/** Year-month bucket key for a paid date (status → PAID timestamp). */
const monthKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}`;
};

/** The trailing 12-month window ending with the current month. */
function trailingTwelveMonths(now: Date) {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return {
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
    };
  });
}

function ChartBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="h-56 w-full">{children}</div>
    </div>
  );
}

function PaidYtdSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-64" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
      <RowsSkeleton rows={3} />
    </div>
  );
}

function PaidYtdBody({
  loading,
  reports,
}: {
  loading: boolean;
  reports: ExpenseReport[];
}) {
  const months = React.useMemo(() => trailingTwelveMonths(new Date()), []);

  // Paid reports whose paid date (updatedAt) falls in the trailing window.
  const windowReports = React.useMemo(() => {
    const keys = new Set(months.map((m) => m.key));
    return reports
      .filter((r) => keys.has(monthKey(r.updatedAt)))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [reports, months]);

  const windowReportIds = React.useMemo(
    () => new Set(windowReports.map((r) => r.id)),
    [windowReports]
  );
  const windowTotal = windowReports.reduce((s, r) => s + r.totalAmount, 0);

  // Bar: paid amount by month across the window.
  const monthly = React.useMemo(() => {
    const totals = new Map(months.map((m) => [m.key, 0]));
    for (const r of windowReports) {
      const key = monthKey(r.updatedAt);
      totals.set(key, (totals.get(key) ?? 0) + r.totalAmount);
    }
    return months.map((m) => ({ month: m.label, total: totals.get(m.key) ?? 0 }));
  }, [months, windowReports]);

  // Pie: paid amount by expense type, from the line-item ledger restricted to
  // the same windowed reports (keeps the breakdown consistent with the bars).
  const ledger = useQuery({
    queryKey: ["ledger", { statuses: ["PAID"] }],
    queryFn: () => getLedgerEntries({ statuses: ["PAID"] }),
  });
  const byType = React.useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of ledger.data ?? []) {
      if (!windowReportIds.has(e.reportId)) continue;
      totals.set(
        e.expenseTypeName,
        (totals.get(e.expenseTypeName) ?? 0) + e.amount
      );
    }
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [ledger.data, windowReportIds]);
  const pieTotal = byType.reduce((s, d) => s + d.value, 0);

  if (loading) return <PaidYtdSkeleton />;
  if (windowReports.length === 0)
    return <EmptyState message="No payments in the last 12 months." />;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {formatCurrency(windowTotal)} paid across {windowReports.length}{" "}
        {windowReports.length === 1 ? "report" : "reports"} in the last 12 months.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <ChartBox title="Paid by month">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={monthly}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="month"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                angle={-35}
                textAnchor="end"
                height={52}
                interval={0}
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
        </ChartBox>

        <ChartBox title="By expense type">
          {ledger.isLoading ? (
            <Skeleton className="h-full w-full rounded-lg" />
          ) : byType.length === 0 ? (
            <EmptyState message="No expense breakdown." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={byType}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {byType.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_PALETTE[i % CHART_PALETTE.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => {
                    const v = Number(value);
                    const pct = pieTotal ? (v / pieTotal) * 100 : 0;
                    return [`${formatCurrency(v)} (${pct.toFixed(1)}%)`, name];
                  }}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartBox>
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
          {windowReports.map((r) => (
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
