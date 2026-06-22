"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { useTheme } from "next-themes";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BRAND_BLUE = "#0b2545";

function resolveAppUrl(): string {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

function isLocalhost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function QrCodeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [appUrl, setAppUrl] = React.useState("");

  // Resolve URL client-side only (window.location.origin is not available SSR).
  React.useEffect(() => {
    if (open) setAppUrl(resolveAppUrl());
  }, [open]);

  const qrFg = isDark ? "#ffffff" : BRAND_BLUE;
  const qrBg = isDark ? "#1e293b" : "#ffffff";
  const showLocalhostTip = appUrl ? isLocalhost(appUrl) : false;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(appUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Open OHI Expense Hub on your phone</DialogTitle>
          <DialogDescription>
            Point your phone&apos;s camera at this QR code to open the app on
            your mobile device.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {appUrl ? (
            <div
              className="rounded-lg p-3"
              style={{ backgroundColor: qrBg }}
            >
              <QRCodeSVG
                value={appUrl}
                size={220}
                fgColor={qrFg}
                bgColor={qrBg}
                level="H"
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-center rounded-lg"
              style={{ width: 244, height: 244, backgroundColor: qrBg }}
            >
              <span className="text-xs text-muted-foreground">Loading…</span>
            </div>
          )}

          {showLocalhostTip && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <strong>Tip:</strong> In dev, replace &ldquo;localhost&rdquo; in
              the URL below with this machine&rsquo;s LAN IP to scan from a
              phone on the same Wi-Fi.
            </p>
          )}

          <p className="w-full select-all break-all rounded-md border border-border bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground font-mono">
            {appUrl || "—"}
          </p>
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={copyLink}
            disabled={!appUrl}
          >
            <Copy className="mr-2 size-3.5" />
            Copy link
          </Button>
          <DialogClose render={<Button size="sm" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
