"use client";

// Primary dashboard actions. New Expense creates a draft then routes to its
// editor; Photo quick-captures a receipt into the gallery; My Expenses and
// Approvals open slide-over Sheets; Receipt Gallery navigates. On mobile the
// Approvals tile is hidden (desktop keeps all five).

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ClipboardCheck,
  FilePlus2,
  Images,
  Loader2,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { createDraft } from "@/lib/data";
import type { ExpenseReport, ReportRoutingRow } from "@/lib/types";
import {
  useApprovalQueue,
  useInvalidateDashboard,
  useMyReports,
} from "@/components/dashboard/use-dashboard-data";
import { StatusPill } from "@/components/status-pill";
import { PhotoCaptureButton } from "@/components/dashboard/photo-capture-button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const TILE =
  "flex h-full w-full flex-col items-center justify-center gap-2 rounded-xl p-4 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

export function ActionButtons({ userId }: { userId: string }) {
  const router = useRouter();
  const invalidate = useInvalidateDashboard();

  const newExpense = useMutation({
    mutationFn: () => {
      const today = new Date().toISOString().slice(0, 10);
      return createDraft({
        reportName: "Untitled report",
        submitterId: userId,
        paidToId: userId,
        periodFrom: today,
        periodTo: today,
      });
    },
    onSuccess: (report) => {
      invalidate();
      router.push(`/reports/${report.id}/edit`);
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not create draft"),
  });

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {/* New Expense (blue) */}
      <button
        type="button"
        className={cn(TILE, "bg-blue-600 hover:bg-blue-600")}
        disabled={newExpense.isPending}
        onClick={() => newExpense.mutate()}
      >
        {newExpense.isPending ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <FilePlus2 className="size-5" />
        )}
        New Expense
      </button>

      {/* Photo — quick receipt capture (teal) */}
      <PhotoCaptureButton
        userId={userId}
        className={cn(TILE, "bg-teal-600 hover:bg-teal-600")}
      />

      {/* My Expenses (indigo) */}
      <Sheet>
        <SheetTrigger
          render={
            <button
              type="button"
              className={cn(TILE, "bg-indigo-600 hover:bg-indigo-600")}
            />
          }
        >
          <ReceiptText className="size-5" />
          My Expenses
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>My Expenses</SheetTitle>
            <SheetDescription>All of your expense reports.</SheetDescription>
          </SheetHeader>
          <MyExpensesList userId={userId} />
        </SheetContent>
      </Sheet>

      {/* Approvals (amber) — desktop only */}
      <Sheet>
        <SheetTrigger
          render={
            <button
              type="button"
              className={cn(TILE, "hidden bg-amber-500 hover:bg-amber-500 md:flex")}
            />
          }
        >
          <ClipboardCheck className="size-5" />
          Approvals
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Approvals</SheetTitle>
            <SheetDescription>Reports needing your action.</SheetDescription>
          </SheetHeader>
          <ApprovalsList userId={userId} />
        </SheetContent>
      </Sheet>

      {/* Receipt Gallery (purple) */}
      <button
        type="button"
        className={cn(TILE, "bg-purple-600 hover:bg-purple-600")}
        onClick={() => router.push("/gallery")}
      >
        <Images className="size-5" />
        Receipt Gallery
      </button>
    </section>
  );
}

// ---------------- Sheet bodies ----------------

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-2 px-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  );
}

function SheetEmpty({ message }: { message: string }) {
  return (
    <div className="px-4">
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        {message}
      </div>
    </div>
  );
}

function ReportRow({ report }: { report: ExpenseReport }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{report.reportName}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatCurrency(report.totalAmount)}
        </p>
      </div>
      <StatusPill status={report.status} />
    </li>
  );
}

function MyExpensesList({ userId }: { userId: string }) {
  const myReports = useMyReports(userId);
  const reports = myReports.data ?? [];

  if (myReports.isLoading) return <ListSkeleton />;
  if (reports.length === 0)
    return <SheetEmpty message="You have no expense reports yet." />;

  return (
    <ul className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
      {reports.map((r) => (
        <ReportRow key={r.id} report={r} />
      ))}
    </ul>
  );
}

function ApprovalsList({ userId }: { userId: string }) {
  const queue = useApprovalQueue(userId);
  const rows: ReportRoutingRow[] = queue.data ?? [];

  if (queue.isLoading) return <ListSkeleton />;
  if (rows.length === 0)
    return <SheetEmpty message="Nothing awaiting your action." />;

  return (
    <ul className="flex flex-col gap-2 overflow-y-auto px-4 pb-4">
      {rows.map(({ report, submitterName }) => (
        <li
          key={report.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{report.reportName}</p>
            <p className="text-xs text-muted-foreground">
              {submitterName} · {formatCurrency(report.totalAmount)}
            </p>
          </div>
          <StatusPill status={report.status} />
        </li>
      ))}
    </ul>
  );
}
