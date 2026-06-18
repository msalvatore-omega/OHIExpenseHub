"use client";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Receipt } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { ReceiptThumb } from "@/components/reports/receipt-thumb";

function ReceiptStatusBadge({ attached }: { attached: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        attached
          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
      )}
    >
      {attached ? "Attached" : "Unattached"}
    </span>
  );
}

export function ReceiptCard({
  receipt,
  selected,
  onToggle,
}: {
  receipt: Receipt;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        "group relative flex w-full min-w-0 flex-col gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected ? "border-primary ring-1 ring-primary" : "border-border"
      )}
    >
      <div className="absolute top-4 left-4 z-10">
        <Checkbox checked={selected} className="pointer-events-none bg-card" />
      </div>

      <ReceiptThumb
        receipt={receipt}
        className="h-32 w-full bg-muted/40 object-cover"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {receipt.merchantName ?? "Unknown merchant"}
          </p>
          <p className="text-xs text-muted-foreground">
            {receipt.merchantDate
              ? formatDate(receipt.merchantDate)
              : "No date"}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {receipt.totalAmount != null
            ? formatCurrency(receipt.totalAmount)
            : "—"}
        </span>
      </div>

      <ReceiptStatusBadge attached={receipt.isAttached} />
    </button>
  );
}
