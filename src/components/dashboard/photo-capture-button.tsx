"use client";

// Quick-capture Photo tile for the dashboard action row. Opens the camera on
// mobile (capture=environment) or a file picker on desktop, runs the shot
// through the shared receipt OCR pipeline, and saves it to the current user's
// Receipt Gallery (isAttached: false) — the same flow as the gallery.

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2 } from "lucide-react";

import { useReceiptCapture } from "@/components/gallery/use-receipt-capture";
import { OcrReviewModal } from "@/components/gallery/ocr-review-modal";

export function PhotoCaptureButton({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const { enqueue, review, saving, processingLabel, onSave, onDiscard } =
    useReceiptCapture({
      userId,
      onSaved: () =>
        queryClient.invalidateQueries({ queryKey: ["receipts", userId] }),
      savedMessage: "Receipt added to your gallery",
    });

  const processing = processingLabel !== null;

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={processing}
        onClick={() => inputRef.current?.click()}
      >
        {processing ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <Camera className="size-5" />
        )}
        Photo
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) enqueue(Array.from(e.target.files));
          e.target.value = "";
        }}
      />

      <OcrReviewModal
        item={review}
        saving={saving}
        onSave={onSave}
        onDiscard={onDiscard}
      />
    </>
  );
}
