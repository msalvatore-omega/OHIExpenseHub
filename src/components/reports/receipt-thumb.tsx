"use client";

import * as React from "react";
import { ReceiptText } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Receipt } from "@/lib/types";

// Receipt thumbnail. Seed receipts point at placeholder image paths that don't
// resolve, so we fall back to an icon tile when the image fails to load.
export function ReceiptThumb({
  receipt,
  className,
}: {
  receipt: Receipt;
  className?: string;
}) {
  const [errored, setErrored] = React.useState(false);

  if (!receipt.imageUrl || errored) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md border border-border bg-muted",
          className
        )}
      >
        <ReceiptText className="size-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={receipt.imageUrl}
      alt={receipt.merchantName ?? "Receipt"}
      onError={() => setErrored(true)}
      className={cn(
        "max-w-full rounded-md border border-border object-cover",
        className
      )}
    />
  );
}
