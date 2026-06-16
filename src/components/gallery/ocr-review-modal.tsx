"use client";

import * as React from "react";
import { FileText, ZoomIn, ZoomOut } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CreateReceiptInput, OcrResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export interface ReviewItem {
  file: File;
  previewUrl: string;
  isPdf: boolean;
  ocr: OcrResult;
}

type SavePayload = Pick<
  CreateReceiptInput,
  "merchantName" | "merchantDate" | "totalAmount" | "taxAmount"
>;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

export function OcrReviewModal({
  item,
  saving,
  onSave,
  onDiscard,
}: {
  item: ReviewItem | null;
  saving: boolean;
  onSave: (data: SavePayload) => void;
  onDiscard: () => void;
}) {
  const [merchantName, setMerchantName] = React.useState("");
  const [date, setDate] = React.useState("");
  const [total, setTotal] = React.useState("");
  const [tax, setTax] = React.useState("");
  const [zoom, setZoom] = React.useState(1);

  // Re-seed the form whenever a new receipt comes up for review.
  React.useEffect(() => {
    if (!item) return;
    setMerchantName(item.ocr.merchantName ?? "");
    setDate(item.ocr.transactionDate ?? "");
    setTotal(item.ocr.total != null ? String(item.ocr.total) : "");
    setTax(item.ocr.tax != null ? String(item.ocr.tax) : "");
    setZoom(1);
  }, [item]);

  const handleSave = () => {
    const parsedTotal = parseFloat(total);
    const parsedTax = parseFloat(tax);
    onSave({
      merchantName: merchantName.trim() || undefined,
      merchantDate: date || undefined,
      totalAmount: Number.isFinite(parsedTotal) ? parsedTotal : undefined,
      taxAmount: Number.isFinite(parsedTax) ? parsedTax : undefined,
    });
  };

  return (
    <Dialog
      open={!!item}
      onOpenChange={(open) => {
        if (!open) onDiscard();
      }}
    >
      <DialogContent className="sm:max-w-3xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Review receipt</DialogTitle>
          <DialogDescription>
            Check the scanned details and correct anything before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Left: image / preview */}
          <div className="flex flex-col gap-2">
            <div className="relative h-72 overflow-auto rounded-lg border border-border bg-muted/30">
              {item?.isPdf ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <FileText className="size-8" />
                  <span className="text-xs">PDF receipt</span>
                </div>
              ) : item ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.previewUrl}
                  alt="Receipt preview"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: "top left",
                  }}
                  className="w-full origin-top-left transition-transform"
                />
              ) : null}
            </div>
            {!item?.isPdf && (
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
                  disabled={zoom <= 1}
                  aria-label="Zoom out"
                >
                  <ZoomOut className="size-4" />
                </Button>
                <span className="w-10 text-center text-xs text-muted-foreground tabular-nums">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
                  disabled={zoom >= 3}
                  aria-label="Zoom in"
                >
                  <ZoomIn className="size-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Right: editable OCR form */}
          <div className="flex flex-col gap-3">
            <Field label="Merchant Name">
              <Input
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
              />
            </Field>
            <Field label="Date">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Total">
                <div className="relative">
                  <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-6"
                    value={total}
                    onChange={(e) => setTotal(e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Tax">
                <div className="relative">
                  <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-6"
                    value={tax}
                    onChange={(e) => setTax(e.target.value)}
                  />
                </div>
              </Field>
            </div>

            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700",
                  "dark:border-red-900 dark:hover:bg-red-950"
                )}
                onClick={onDiscard}
                disabled={saving}
              >
                Discard
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={handleSave}
                disabled={saving}
              >
                Save Receipt
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
