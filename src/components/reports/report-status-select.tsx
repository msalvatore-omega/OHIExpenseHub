"use client";

// Accounting/admin status override for a report. Writes the change (which the
// data layer audits) and refreshes the affected queries. Used both in the
// Expense Reports table and the opened report view.

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { changeReportStatus, getReport } from "@/lib/data";
import { toastQueuedNotifications } from "@/lib/notify";
import { useSession } from "@/lib/auth/mock-session";
import { dashboardKeys } from "@/components/dashboard/use-dashboard-data";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "ACCOUNTING_REVIEW", label: "Accounting Review" },
  { value: "EXECUTIVE_REVIEW", label: "Executive Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PAID", label: "Paid" },
];

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

export function ReportStatusSelect({
  reportId,
  status,
  className,
}: {
  reportId: string;
  /** Current status. Omit to resolve it from the shared report query. */
  status?: ReportStatus;
  className?: string;
}) {
  const { user } = useSession();
  const qc = useQueryClient();

  // When no status is passed (e.g. the opened report view), read it from the
  // same ["report", id] cache entry the detail view already populates.
  const reportQuery = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId),
    enabled: status === undefined,
  });
  const current = status ?? reportQuery.data?.status;

  const mutation = useMutation({
    mutationFn: (next: ReportStatus) =>
      changeReportStatus(reportId, next, user.id),
    onSuccess: (result) => {
      toastQueuedNotifications(result.notifications);
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["accounting-reports"] });
      qc.invalidateQueries({ queryKey: ["report", reportId] });
      qc.invalidateQueries({ queryKey: ["report-changes"] });
      qc.invalidateQueries({ queryKey: ["report-change-log", reportId] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: dashboardKeys.all });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  if (!current) return <Skeleton className="h-8 w-28 rounded-lg" />;

  return (
    <span className="inline-flex items-center gap-1.5">
      <select
        aria-label="Change report status"
        className={cn(SELECT_CLASS, className)}
        value={current}
        disabled={mutation.isPending}
        onChange={(e) => mutation.mutate(e.target.value as ReportStatus)}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {mutation.isPending && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
    </span>
  );
}
