"use client";

// Quick-capture Photo tile for the dashboard action row. Opens the camera on
// mobile / a file picker on desktop, runs the shot through the shared receipt
// OCR pipeline, and saves it to the current user's Receipt Gallery
// (isAttached: false) — the same flow and capture control as the gallery.

import { useQueryClient } from "@tanstack/react-query";

import { useReceiptCapture } from "@/components/gallery/use-receipt-capture";
import { OcrReviewModal } from "@/components/gallery/ocr-review-modal";
import { CameraCaptureButton } from "@/components/gallery/camera-capture-button";

export function PhotoCaptureButton({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const queryClient = useQueryClient();

  const { enqueue, review, saving, processingLabel, onSave, onDiscard } =
    useReceiptCapture({
      userId,
      onSaved: () =>
        queryClient.invalidateQueries({ queryKey: ["receipts", userId] }),
      savedMessage: "Receipt added to your gallery",
    });

  return (
    <>
      <CameraCaptureButton
        onFiles={(files) => enqueue(files, "CAMERA")}
        processing={processingLabel !== null}
        className={className}
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
