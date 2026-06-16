"use client";

import * as React from "react";
import { Camera, Loader2, Upload, UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const ACCEPT = "image/jpeg,image/png,application/pdf";

export function UploadZone({
  onFiles,
  processingLabel,
}: {
  onFiles: (files: File[]) => void;
  /** When set, a "Processing receipt…" indicator is shown. */
  processingLabel?: string | null;
}) {
  const browseInput = React.useRef<HTMLInputElement>(null);
  const cameraInput = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const pick = (list: FileList | null) => {
    if (!list || list.length === 0) return;
    onFiles(Array.from(list));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Desktop: drag-and-drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={cn(
          "hidden flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors md:flex",
          dragging
            ? "border-primary bg-accent/50"
            : "border-border bg-muted/30"
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium">
            Drag &amp; drop receipts here
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, or PDF — multiple files supported
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => browseInput.current?.click()}
        >
          <Upload className="size-4" />
          Browse Files
        </Button>
      </div>

      {/* Mobile: capture + upload */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        <Button
          type="button"
          onClick={() => cameraInput.current?.click()}
          className="h-12"
        >
          <Camera className="size-5" />
          Take Photo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => browseInput.current?.click()}
          className="h-12"
        >
          <Upload className="size-5" />
          Upload from Device
        </Button>
      </div>

      {processingLabel && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          {processingLabel}
        </div>
      )}

      {/* Hidden inputs */}
      <input
        ref={browseInput}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
