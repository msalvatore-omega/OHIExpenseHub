"use client";

import * as React from "react";
import { Loader2, Paperclip, Upload } from "lucide-react";
import { toast } from "sonner";

import { formatCurrency, formatDate } from "@/lib/format";
import { OcrTimeoutError, processReceipt } from "@/lib/data/ocr";
import { createReceipt } from "@/lib/data";
import type { CreateReceiptInput, Receipt, ReceiptSource } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CameraCaptureButton } from "@/components/gallery/camera-capture-button";
import { OcrReviewModal, type ReviewItem } from "@/components/gallery/ocr-review-modal";
import { ReceiptThumb } from "@/components/reports/receipt-thumb";

type SavePayload = Pick<
  CreateReceiptInput,
  "merchantName" | "merchantDate" | "totalAmount" | "taxAmount"
>;

// Opens a dialog to attach a receipt: upload/camera to create a new one, or
// pick one from the user's existing unattached gallery receipts.
export function AttachReceiptDialog({
  receipts,
  onSelect,
  userId,
}: {
  receipts: Receipt[];
  onSelect: (receipt: Receipt) => void;
  userId: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [processing, setProcessing] = React.useState<string | null>(null);
  const [review, setReview] = React.useState<ReviewItem | null>(null);
  const [saving, setSaving] = React.useState(false);
  const sourceRef = React.useRef<ReceiptSource>("UPLOAD");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(files: File[], source: ReceiptSource) {
    if (!files.length) return;
    const file = files[0];
    sourceRef.current = source;
    const previewUrl = URL.createObjectURL(file);
    const isPdf = file.type === "application/pdf";
    setProcessing(file.name);
    try {
      const ocr = await processReceipt(file);
      setProcessing(null);
      setReview({ file, previewUrl, isPdf, ocr });
    } catch (err) {
      setProcessing(null);
      if (err instanceof OcrTimeoutError) {
        try {
          const receipt = await createReceipt({
            userId,
            source: sourceRef.current,
            imageUrl: previewUrl,
          });
          onSelect(receipt);
          setOpen(false);
          toast.warning(
            "OCR timed out — receipt saved, please fill in details manually."
          );
        } catch {
          URL.revokeObjectURL(previewUrl);
          toast.error("Could not save receipt");
        }
      } else {
        URL.revokeObjectURL(previewUrl);
        toast.error("Could not process receipt");
      }
    }
  }

  async function handleSave(data: SavePayload) {
    if (!review) return;
    setSaving(true);
    try {
      const receipt = await createReceipt({
        userId,
        source: sourceRef.current,
        imageUrl: review.previewUrl,
        ...data,
      });
      onSelect(receipt);
      setReview(null);
      setOpen(false);
    } catch {
      toast.error("Could not save receipt");
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    if (review) URL.revokeObjectURL(review.previewUrl);
    setReview(null);
  }

  return (
    <>
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
              Upload a new receipt or choose from your gallery.
            </DialogDescription>
          </DialogHeader>

          {/* Upload / Camera */}
          <div className="flex items-center gap-2">
            {processing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Processing {processing}…
              </div>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3.5" />
                  Upload File
                </Button>
                <CameraCaptureButton
                  onFiles={(files) => handleFiles(files, "CAMERA")}
                  iconClassName="size-3.5"
                  label="Take Photo"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                />
              </>
            )}
          </div>

          {/* Gallery */}
          {receipts.length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              No unattached receipts in your gallery.
            </div>
          ) : (
            <>
              <p className="-mb-1 text-xs text-muted-foreground">
                Or choose from your gallery:
              </p>
              <div className="grid max-h-[50vh] grid-cols-2 gap-3 overflow-y-auto">
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
            </>
          )}
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFiles([e.target.files[0]], "UPLOAD");
          e.target.value = "";
        }}
      />

      <OcrReviewModal
        item={review}
        saving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </>
  );
}
