"use client";

// Print-optimised expense report. Lives inside the app shell, but @media print
// + print:hidden utilities strip all chrome so only this document prints.
// Opened with ?autoprint=1 (from the Export PDF button) it prints automatically.

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Printer, X } from "lucide-react";

import { APP_NAME } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getExpenseTypes,
  getReceipts,
  getReport,
  getUsers,
} from "@/lib/data";
import type { ExpenseLineItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ReceiptThumb } from "@/components/reports/receipt-thumb";

const ACTION_LABEL = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 font-medium text-muted-foreground">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function ReportPrintView({ reportId }: { reportId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const autoprint = searchParams.get("autoprint") === "1";

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

  const ready =
    reportQuery.data &&
    usersQuery.data &&
    typesQuery.data &&
    receiptsQuery.data;

  // Auto-print once everything is loaded.
  const printedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoprint && ready && !printedRef.current) {
      printedRef.current = true;
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoprint, ready]);

  if (!ready) {
    return (
      <div className="p-10 text-sm text-muted-foreground">Preparing report…</div>
    );
  }

  const report = reportQuery.data!;
  const nameById = new Map(usersQuery.data!.map((u) => [u.id, u.name]));
  const typeById = new Map(typesQuery.data!.map((t) => [t.id, t]));
  const receiptById = new Map(receiptsQuery.data!.map((r) => [r.id, r]));
  const name = (id?: string) => (id && nameById.get(id)) || "—";

  const ownerId = report.onBehalfOfId ?? report.submitterId;
  const exportDate = new Date();

  // Group line items by expense type for subtotals.
  const orderedTypeIds: string[] = [];
  const byType = new Map<string, ExpenseLineItem[]>();
  for (const li of report.lineItems) {
    if (!byType.has(li.expenseTypeId)) {
      byType.set(li.expenseTypeId, []);
      orderedTypeIds.push(li.expenseTypeId);
    }
    byType.get(li.expenseTypeId)!.push(li);
  }

  const location = (li: ExpenseLineItem) =>
    [li.city, li.state, li.country].filter(Boolean).join(", ");

  const receiptsForPrint = report.lineItems
    .map((li) => (li.receiptId ? receiptById.get(li.receiptId) : undefined))
    .filter((r): r is NonNullable<typeof r> => Boolean(r));

  let rowNum = 0;

  return (
    <div className="mx-auto w-full max-w-3xl bg-white px-6 py-8 text-foreground print:max-w-none print:px-0">
      {/* Screen-only toolbar */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <X className="size-4" />
          Close
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" />
          Print
        </Button>
      </div>

      {/* Header + logo */}
      <header className="flex items-center justify-between border-b-2 border-primary pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">EXPENSE REPORT</h1>
          <p className="text-sm text-muted-foreground">{APP_NAME}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex size-11 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            OHI
          </div>
          <span className="text-sm font-semibold leading-tight">
            OHI Expense
            <br />
            Hub
          </span>
        </div>
      </header>

      {/* Two-column info block */}
      <section className="grid grid-cols-1 gap-x-8 gap-y-2 py-5 sm:grid-cols-2">
        <InfoRow label="Report Name" value={report.reportName} />
        <InfoRow
          label="Period"
          value={`${formatDate(report.periodFrom)} – ${formatDate(report.periodTo)}`}
        />
        <InfoRow label="Report ID" value={report.id} />
        <InfoRow label="Status" value={report.status} />
        <InfoRow label="Submitter" value={name(ownerId)} />
        <InfoRow
          label="Submitted"
          value={report.submittedAt ? formatDate(report.submittedAt) : "—"}
        />
        <InfoRow label="Paid To" value={name(report.paidToId)} />
        <InfoRow label="Export Date" value={formatDate(exportDate.toISOString())} />
      </section>

      {/* Approval chain */}
      <section className="py-2">
        <h2 className="mb-2 text-sm font-semibold">Approval Chain</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-border bg-muted/60 text-left">
              <th className="px-2 py-1.5 font-semibold">Approver</th>
              <th className="px-2 py-1.5 font-semibold">Action</th>
              <th className="px-2 py-1.5 font-semibold">Date</th>
              <th className="px-2 py-1.5 font-semibold">Comment</th>
            </tr>
          </thead>
          <tbody>
            {report.approvalHistory.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-2 py-2 text-muted-foreground">
                  No approval activity.
                </td>
              </tr>
            ) : (
              report.approvalHistory.map((h) => (
                <tr key={h.id} className="border-b border-border align-top">
                  <td className="px-2 py-1.5">{name(h.approverId)}</td>
                  <td className="px-2 py-1.5">{ACTION_LABEL[h.action]}</td>
                  <td className="px-2 py-1.5">{formatDate(h.createdAt)}</td>
                  <td className="px-2 py-1.5">{h.comment ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {/* Line items with per-type subtotals */}
      <section className="py-2">
        <h2 className="mb-2 text-sm font-semibold">Line Items</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-border bg-muted/60 text-left">
              <th className="px-2 py-1.5 font-semibold">#</th>
              <th className="px-2 py-1.5 font-semibold">Date</th>
              <th className="px-2 py-1.5 font-semibold">Type</th>
              <th className="px-2 py-1.5 font-semibold">Description</th>
              <th className="px-2 py-1.5 font-semibold">Location</th>
              <th className="px-2 py-1.5 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {orderedTypeIds.map((typeId) => {
              const items = byType.get(typeId)!;
              const subtotal = items.reduce((s, li) => s + li.amount, 0);
              const typeName = typeById.get(typeId)?.displayName ?? "—";
              return (
                <React.Fragment key={typeId}>
                  {items.map((li) => {
                    rowNum += 1;
                    return (
                      <tr key={li.id} className="border-b border-border align-top">
                        <td className="px-2 py-1.5">{rowNum}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {formatDate(li.expenseDate)}
                        </td>
                        <td className="px-2 py-1.5">{typeName}</td>
                        <td className="px-2 py-1.5">{li.description}</td>
                        <td className="px-2 py-1.5">{location(li)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">
                          {formatCurrency(li.amount)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-b border-border bg-muted/30">
                    <td colSpan={5} className="px-2 py-1.5 text-right text-muted-foreground">
                      Subtotal — {typeName}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                      {formatCurrency(subtotal)}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
            <tr className="border-t-2 border-primary">
              <td colSpan={5} className="px-2 py-2 text-right font-bold">
                Total
              </td>
              <td className="px-2 py-2 text-right font-bold tabular-nums">
                {formatCurrency(report.totalAmount)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Receipts — printed after the summary */}
      {receiptsForPrint.length > 0 && (
        <section className="break-before-page pt-4">
          <h2 className="mb-3 text-sm font-semibold">Receipts</h2>
          <div className="flex flex-col gap-6">
            {receiptsForPrint.map((receipt) => (
              <div key={receipt.id} className="break-inside-avoid">
                <p className="mb-1 text-sm font-medium">
                  {receipt.merchantName ?? "Receipt"}
                  {receipt.merchantDate
                    ? ` · ${formatDate(receipt.merchantDate)}`
                    : ""}
                  {receipt.totalAmount != null
                    ? ` · ${formatCurrency(receipt.totalAmount)}`
                    : ""}
                </p>
                <ReceiptThumb
                  receipt={receipt}
                  className="h-64 w-full max-w-md border border-border object-contain"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-8 border-t border-border pt-3 text-xs text-muted-foreground">
        Generated {exportDate.toLocaleString("en-US")} · {APP_NAME}
      </footer>
    </div>
  );
}
