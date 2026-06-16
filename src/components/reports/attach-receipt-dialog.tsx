"use client";

import * as React from "react";
import { Paperclip } from "lucide-react";

import { formatCurrency, formatDate } from "@/lib/format";
import type { Receipt } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ReceiptThumb } from "@/components/reports/receipt-thumb";

// Opens a dialog of the user's unattached receipts as selectable cards.
export function AttachReceiptDialog({
  receipts,
  onSelect,
}: {
  receipts: Receipt[];
  onSelect: (receipt: Receipt) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <Paperclip className="size-3.5" />
        Attach
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach a receipt</DialogTitle>
          <DialogDescription>
            Select one of your unattached receipts.
          </DialogDescription>
        </DialogHeader>

        {receipts.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            No unattached receipts available.
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto">
            {receipts.map((receipt) => (
              <button
                key={receipt.id}
                type="button"
                onClick={() => {
                  onSelect(receipt);
                  setOpen(false);
                }}
                className="flex flex-col gap-2 rounded-lg border border-border p-3 text-left transition-colors hover:border-ring hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <ReceiptThumb receipt={receipt} className="h-20 w-full" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {receipt.merchantName ?? "Unknown merchant"}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(receipt.totalAmount ?? 0)}
                    {receipt.merchantDate
                      ? ` · ${formatDate(receipt.merchantDate)}`
                      : ""}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
