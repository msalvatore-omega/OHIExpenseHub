// Status pill, themed via Deep Harbor tokens.
//
// Subtle statuses derive a faint fill at runtime from their own colour
// (color-mix(... 14%, transparent)) and use the full colour for text/icon — no
// separate background tokens. PAID is shown as a solid gold "settled" pill
// (gold = money/emphasis, deliberately NOT the green success/approved meaning).

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import type { ReportStatus } from "@/lib/types";

type PillStyle =
  | { kind: "tint"; color: string }
  | { kind: "solid"; bg: string; fg: string };

const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; style: PillStyle }
> = {
  DRAFT: { label: "Draft", style: { kind: "tint", color: "var(--muted-foreground)" } },
  SUBMITTED: { label: "Submitted", style: { kind: "tint", color: "var(--primary)" } },
  IN_REVIEW: { label: "In Review", style: { kind: "tint", color: "var(--warning)" } },
  ACCOUNTING_REVIEW: {
    label: "Accounting Review",
    style: { kind: "tint", color: "oklch(0.65 0.15 50)" },
  },
  EXECUTIVE_REVIEW: {
    label: "Executive Review",
    style: { kind: "tint", color: "oklch(0.55 0.20 295)" },
  },
  APPROVED: { label: "Approved", style: { kind: "tint", color: "var(--success)" } },
  REJECTED: { label: "Rejected", style: { kind: "tint", color: "var(--danger)" } },
  PAID: {
    label: "Paid",
    style: { kind: "solid", bg: "var(--accent)", fg: "var(--accent-foreground)" },
  },
};

export function StatusPill({
  status,
  className,
}: {
  status: ReportStatus;
  className?: string;
}) {
  const { label, style } = STATUS_CONFIG[status];

  const css: CSSProperties =
    style.kind === "tint"
      ? {
          // Fill: a faint tint of the status colour.
          backgroundColor: `color-mix(in srgb, ${style.color} 14%, transparent)`,
          // Text: the status colour nudged toward --foreground so it clears
          // WCAG AA on the light tint (and stays bright on dark). The hue is
          // preserved; only lightness shifts (darker on light, lighter on dark).
          color: `color-mix(in srgb, ${style.color} 60%, var(--foreground))`,
        }
      : { color: style.fg, backgroundColor: style.bg };

  return (
    <span
      style={css}
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        className
      )}
    >
      {label}
    </span>
  );
}
