"use client";

// Shared receipt capture pipeline: object URL -> processReceipt() (mock OCR) ->
// review modal -> persist via createReceipt(). Files are processed one at a time
// so each opens its own review modal. Used by the Receipt Gallery and the Home
// dashboard's quick-capture Photo button so both share an identical flow.

import * as React from "react";
import { toast } from "sonner";

import { OcrTimeoutError, processReceipt } from "@/lib/data/ocr";
import { createReceipt } from "@/lib/data";
import type { CreateReceiptInput } from "@/lib/types";
import type { ReviewItem } from "@/components/gallery/ocr-review-modal";

type SavePayload = Pick<
  CreateReceiptInput,
  "merchantName" | "merchantDate" | "totalAmount" | "taxAmount"
>;

export interface ReceiptCapture {
  /** Queue captured/selected files for OCR processing. */
  enqueue: (files: File[]) => void;
  /** The item currently awaiting review, if any (drives the review modal). */
  review: ReviewItem | null;
  saving: boolean;
  /** "Processing receipt: …" label while OCR runs, else null. */
  processingLabel: string | null;
  onSave: (data: SavePayload) => Promise<void>;
  onDiscard: () => void;
}

export function useReceiptCapture({
  userId,
  onSaved,
  savedMessage = "Receipt saved",
}: {
  userId: string;
  /** Called after a receipt is persisted (e.g. to refresh the gallery query). */
  onSaved?: () => void;
  /** Success-toast copy shown when a reviewed receipt is saved. */
  savedMessage?: string;
}): ReceiptCapture {
  const queueRef = React.useRef<File[]>([]);
  const busyRef = React.useRef(false);
  // Holds the latest pump() so the async worker can advance the queue without
  // referencing itself (avoids a stale self-recursive closure).
  const pumpRef = React.useRef<() => void>(() => {});
  const [processing, setProcessing] = React.useState<string | null>(null);
  const [queuedCount, setQueuedCount] = React.useState(0);
  const [review, setReview] = React.useState<ReviewItem | null>(null);
  const [saving, setSaving] = React.useState(false);

  const pump = React.useCallback(() => {
    if (busyRef.current) return;
    const file = queueRef.current.shift();
    setQueuedCount(queueRef.current.length);
    if (!file) return;
    busyRef.current = true;

    void (async () => {
      const previewUrl = URL.createObjectURL(file);
      const isPdf = file.type === "application/pdf";
      setProcessing(file.name);
      try {
        const ocr = await processReceipt(file);
        setProcessing(null);
        setReview({ file, previewUrl, isPdf, ocr });
        // busy stays true until the user saves/discards in the modal.
      } catch (err) {
        setProcessing(null);
        if (err instanceof OcrTimeoutError) {
          try {
            await createReceipt({ userId, imageUrl: previewUrl });
            onSaved?.();
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
        busyRef.current = false;
        pumpRef.current();
      }
    })();
  }, [onSaved, userId]);

  // Keep the ref pointed at the current pump for the async worker above.
  React.useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const enqueue = React.useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      queueRef.current.push(...files);
      setQueuedCount(queueRef.current.length);
      pump();
    },
    [pump]
  );

  const onSave = React.useCallback(
    async (data: SavePayload) => {
      if (!review) return;
      setSaving(true);
      try {
        await createReceipt({ userId, imageUrl: review.previewUrl, ...data });
        onSaved?.();
        toast.success(savedMessage);
        setReview(null);
      } catch {
        toast.error("Could not save receipt");
      } finally {
        setSaving(false);
        busyRef.current = false;
        pump();
      }
    },
    [review, userId, onSaved, savedMessage, pump]
  );

  const onDiscard = React.useCallback(() => {
    if (review) URL.revokeObjectURL(review.previewUrl);
    setReview(null);
    busyRef.current = false;
    pump();
  }, [review, pump]);

  const processingLabel = processing
    ? `Processing receipt: ${processing}${
        queuedCount > 0 ? ` (+${queuedCount} queued)` : ""
      }…`
    : null;

  return { enqueue, review, saving, processingLabel, onSave, onDiscard };
}
