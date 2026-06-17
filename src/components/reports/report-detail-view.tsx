"use client";

// Read-only report detail layout: header, line items with receipt thumbnails,
// and the approval-history timeline. Shared by the approval review screen and
// the accounting read-only view so both render an identical report.

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { getExpenseTypes, getReceipts, getReport, getUsers } from "@/lib/data";
import type { ApprovalAction, Receipt } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";
import {
  Dialog,
  DialogContent,
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
import { ReceiptThumb } from "@/components/reports/receipt-thumb";

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

const ACTION_META: Record<
  ApprovalAction,
  { icon: typeof Clock; className: string; label: string }
> = {
  PENDING: { icon: Clock, className: "text-amber-600", label: "Pending" },
  APPROVED: {
    icon: CheckCircle2,
    className: "text-green-600",
    label: "Approved",
  },
  REJECTED: { icon: XCircle, className: "text-red-600", label: "Rejected" },
};

export function ReportDetailView({
  reportId,
  actions,
  footer,
  reserveBottomSpace = false,
}: {
  reportId: string;
  /** Right-aligned header slot (e.g. export buttons). */
  actions?: React.ReactNode;
  /** Rendered after the content (e.g. a sticky decision panel). */
  footer?: React.ReactNode;
  /** Adds extra bottom padding so a fixed footer doesn't cover content. */
  reserveBottomSpace?: boolean;
}) {
  const reportQuery = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId),
  });
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const typesQuery = useQuery({
    queryKey: ["expense-types"],
    queryFn: getExpenseTypes,
  });
  const receiptsQuery = useQuery({
    queryKey: ["all-receipts"],
    queryFn: () => getReceipts(),
  });

  const [lightbox, setLightbox] = React.useState<Receipt | null>(null);

  const nameById = new Map((usersQuery.data ?? []).map((u) => [u.id, u.name]));
  const typeName = new Map(
    (typesQuery.data ?? []).map((t) => [t.id, t.displayName])
  );
  const receiptById = new Map((receiptsQuery.data ?? []).map((r) => [r.id, r]));

  if (reportQuery.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const report = reportQuery.data;
  if (!report) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1>Report not found</h1>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8",
        reserveBottomSpace && "pb-40"
      )}
    >
      {/* Read-only header */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1>{report.reportName}</h1>
          <div className="flex items-center gap-3">
            <StatusPill status={report.status} />
            {actions}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-4">
          <HeaderField
            label="Submitter"
            value={nameById.get(report.submitterId) ?? "—"}
          />
          <HeaderField
            label="Paid To"
            value={nameById.get(report.paidToId) ?? "—"}
          />
          <HeaderField
            label="Period"
            value={`${formatDate(report.periodFrom)} – ${formatDate(
              report.periodTo
            )}`}
          />
          <HeaderField label="Total" value={formatCurrency(report.totalAmount)} />
        </div>
      </header>

      {/* Line items */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Line items</h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.lineItems.map((li) => {
                const receipt = li.receiptId
                  ? receiptById.get(li.receiptId)
                  : undefined;
                return (
                  <TableRow key={li.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDate(li.expenseDate)}
                    </TableCell>
                    <TableCell>{typeName.get(li.expenseTypeId) ?? "—"}</TableCell>
                    <TableCell className="font-medium">{li.description}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {[li.city, li.state, li.country].filter(Boolean).join(", ")}
                    </TableCell>
                    <TableCell>
                      {receipt ? (
                        <button
                          type="button"
                          onClick={() => setLightbox(receipt)}
                          className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                          aria-label="Enlarge receipt"
                        >
                          <ReceiptThumb receipt={receipt} className="size-10" />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(li.amount)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Approval history timeline */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Approval history
        </h2>
        {report.approvalHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {report.approvalHistory.map((h) => {
              const meta = ACTION_META[h.action];
              const Icon = meta.icon;
              return (
                <li key={h.id} className="flex gap-3">
                  <Icon className={cn("mt-0.5 size-5 shrink-0", meta.className)} />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{meta.label}</span>
                      {" · "}
                      <span className="text-muted-foreground">
                        {nameById.get(h.approverId) ?? "System"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(h.createdAt)}
                    </p>
                    {h.comment && (
                      <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-sm">
                        {h.comment}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {footer}

      {/* Receipt lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{lightbox?.merchantName ?? "Receipt"}</DialogTitle>
          </DialogHeader>
          {lightbox && (
            <ReceiptThumb receipt={lightbox} className="max-h-[70vh] w-full" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
