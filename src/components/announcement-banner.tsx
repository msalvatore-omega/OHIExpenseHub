"use client";

// Dismissable announcement banner shown at the top of every page when the admin
// has published a message. The visual shell (AnnouncementBannerView) is shared
// with the Admin "System" tab preview so the preview matches exactly.

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useSystemSettings } from "@/lib/use-system-settings";

// Per-session, per-message dismissal. Storing the dismissed message text means a
// new/edited message reappears for everyone (it differs from what was dismissed).
// sessionStorage (NOT localStorage) is deliberate: it clears when the tab/window
// closes, so a new browser session always shows the banner fresh.
const DISMISS_KEY = "ohi-dismissed-announcement";

/**
 * Forget any in-session dismissal so the banner shows again. Called on login so
 * a fresh sign-in always starts a clean session, even in the same browser tab.
 */
export function clearAnnouncementDismissal(): void {
  try {
    sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    // sessionStorage unavailable — nothing to clear.
  }
}

/** Render announcement text with minimal markdown: **bold** + preserved newlines. */
export function AnnouncementText({ message }: { message: string }) {
  return (
    <span className="whitespace-pre-wrap break-words">
      {message.split("**").map((seg, i) =>
        i % 2 === 1 ? (
          <strong key={i}>{seg}</strong>
        ) : (
          <React.Fragment key={i}>{seg}</React.Fragment>
        )
      )}
    </span>
  );
}

/** The styled banner shell. Shown both live and in the admin preview. */
export function AnnouncementBannerView({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 border-l-4 px-6 py-3 text-sm print:hidden",
        // Light: yellow-100 bg, yellow-600 left border, dark amber text.
        "border-[#CA8A04] bg-[#FEF9C3] text-[#713F12]",
        // Dark: muted amber tint that reads on dark backgrounds.
        "dark:border-amber-500/70 dark:bg-amber-950/40 dark:text-amber-100"
      )}
    >
      <div className="min-w-0 flex-1 leading-relaxed">
        <AnnouncementText message={message} />
      </div>
      <button
        type="button"
        onClick={() => onDismiss?.()}
        aria-label="Dismiss announcement"
        className="shrink-0 rounded-md p-0.5 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** The live banner: reads the published message and handles session dismissal. */
export function AnnouncementBanner() {
  const { data } = useSystemSettings();
  const message = data?.announcementMessage ?? "";

  // Read the per-session dismissal lazily (SSR-safe). The banner only renders
  // once `message` arrives client-side, so this never causes a hydration diff.
  const [dismissed, setDismissed] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  if (!message || dismissed === message) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, message);
    } catch {
      // ignore
    }
    setDismissed(message);
  };

  return <AnnouncementBannerView message={message} onDismiss={dismiss} />;
}
