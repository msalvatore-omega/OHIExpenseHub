"use client";

import { Mail, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type { Receipt } from "@/lib/types";
import { Button } from "@/components/ui/button";
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

function EmailSourceTag() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      <Mail className="size-3" />
      Email
    </span>
  );
}

/** Card for live (non-trashed) receipts in the All / Unattached / Attached tabs. */
export function ReceiptCard({
  receipt,
  selected,
  onToggle,
  onTrash,
}: {
  receipt: Receipt;
  selected: boolean;
  onToggle: () => void;
  onTrash?: () => void;
}) {
  const canTrash = !receipt.isAttached && onTrash;

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

      {/* Trash button — only on unattached receipts */}
      {canTrash && (
        <div className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon-sm"
            title="Move to Trash"
            aria-label="Move to Trash"
            onClick={(e) => {
              e.stopPropagation();
              onTrash();
            }}
            className="bg-card/80 hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      )}

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
            {receipt.merchantDate ? formatDate(receipt.merchantDate) : "No date"}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {receipt.totalAmount != null ? formatCurrency(receipt.totalAmount) : "—"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ReceiptStatusBadge attached={receipt.isAttached} />
        {receipt.source === "EMAIL" && <EmailSourceTag />}
      </div>
    </button>
  );
}

/** Card for trashed receipts shown in the Trash tab. */
export function TrashReceiptCard({
  receipt,
  deletedByName,
  expiresOn,
  selected,
  onToggle,
  onRestore,
  onHardDelete,
}: {
  receipt: Receipt;
  deletedByName: string;
  expiresOn: Date;
  selected: boolean;
  onToggle: () => void;
  onRestore: () => void;
  onHardDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm",
        selected ? "border-primary ring-1 ring-primary" : "border-border"
      )}
    >
      {/* Checkbox toggle area */}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        className="absolute inset-0 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="Select receipt"
      />

      <div className="pointer-events-none absolute top-4 left-4 z-10">
        <Checkbox checked={selected} className="bg-card" />
      </div>

      <ReceiptThumb
        receipt={receipt}
        className="h-32 w-full bg-muted/40 object-cover opacity-60"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {receipt.merchantName ?? "Unknown merchant"}
          </p>
          <p className="text-xs text-muted-foreground">
            {receipt.merchantDate ? formatDate(receipt.merchantDate) : "No date"}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
          {receipt.totalAmount != null ? formatCurrency(receipt.totalAmount) : "—"}
        </span>
      </div>

      <div className="space-y-0.5 text-xs text-muted-foreground">
        <p>
          Trashed {receipt.deletedAt ? formatDateTime(receipt.deletedAt) : "—"}
          {deletedByName ? ` by ${deletedByName}` : ""}
        </p>
        <p className="text-destructive/80">
          Permanently deleted on {expiresOn.toLocaleDateString()}
        </p>
      </div>

      <div className="relative z-10 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={(e) => { e.stopPropagation(); onRestore(); }}
        >
          Restore
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onHardDelete(); }}
        >
          Delete permanently
        </Button>
      </div>
    </div>
  );
}
