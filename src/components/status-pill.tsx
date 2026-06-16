// Status pill with the spec colour mapping:
// DRAFT gray · SUBMITTED blue · IN_REVIEW amber · APPROVED green ·
// REJECTED red · PAID teal.

import { cn } from "@/lib/utils";
import type { ReportStatus } from "@/lib/types";

const STATUS_STYLES: Record<ReportStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  IN_REVIEW: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  PAID: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};

export function StatusPill({
  status,
  className,
}: {
  status: ReportStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLES[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
