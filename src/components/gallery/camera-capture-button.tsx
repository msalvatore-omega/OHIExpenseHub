"use client";

// Shared camera capture trigger: a button + a hidden file input that opens the
// camera on mobile (capture=environment) or a file picker on desktop, handing
// the chosen file(s) to onFiles. Used by the dashboard Scan Receipt tile and
// the Receipt Gallery upload zone so the capture control is identical in both.

import * as React from "react";
import { Camera, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function CameraCaptureButton({
  onFiles,
  processing = false,
  className,
  iconClassName = "size-5",
  label = "Scan Receipt",
}: {
  onFiles: (files: File[]) => void;
  /** Disables the button and shows a spinner while a capture is processing. */
  processing?: boolean;
  className?: string;
  iconClassName?: string;
  label?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={processing}
        onClick={() => inputRef.current?.click()}
      >
        {processing ? (
          <Loader2 className={cn(iconClassName, "animate-spin")} />
        ) : (
          <Camera className={iconClassName} />
        )}
        {label}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </>
  );
}
