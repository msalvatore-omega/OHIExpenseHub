"use client";

// Route-aware breadcrumb trail rendered at the top of the main content area on
// every authenticated page. The first crumb is always Home (house icon) linking
// to /dashboard; trails come from a route map (so e.g. /reports/new reads
// "Home / New Expense", not "Home / Reports / New"). Dynamic report routes
// resolve the last crumb to the report's name. The current page is plain text;
// earlier crumbs are links.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Home } from "lucide-react";

import { cn } from "@/lib/utils";
import { getReport } from "@/lib/data";

/** Sentinel label replaced with the resolved report name at render time. */
const REPORT = "::report-name::";

interface Crumb {
  label: string;
  /** Link target for non-current crumbs. The last crumb renders as text. */
  href?: string;
}

// Ordered route map. ":id" matches a single dynamic segment. Crumbs listed here
// are appended after the implicit Home crumb. The final rendered crumb (the
// current page) is always plain text regardless of any href below.
const TRAILS: { pattern: string; crumbs: Crumb[] }[] = [
  { pattern: "/dashboard", crumbs: [] },
  { pattern: "/reports/new", crumbs: [{ label: "New Expense" }] },
  { pattern: "/new-expense", crumbs: [{ label: "New Expense" }] },
  { pattern: "/reports/:id/edit", crumbs: [{ label: REPORT }] },
  { pattern: "/reports/:id/print", crumbs: [{ label: REPORT }] },
  { pattern: "/my-expenses", crumbs: [{ label: "My Expenses" }] },
  { pattern: "/gallery", crumbs: [{ label: "Receipt Gallery" }] },
  { pattern: "/receipts", crumbs: [{ label: "Receipts" }] },
  { pattern: "/approvals", crumbs: [{ label: "Approvals" }] },
  {
    pattern: "/approvals/:id",
    crumbs: [{ label: "Approvals", href: "/approvals" }, { label: REPORT }],
  },
  { pattern: "/admin", crumbs: [{ label: "Admin" }] },
  {
    pattern: "/admin/analytics",
    crumbs: [
      { label: "Admin", href: "/admin" },
      { label: "User Analytics" },
    ],
  },
  {
    pattern: "/admin/expense-reports",
    crumbs: [
      { label: "Admin", href: "/admin" },
      { label: "Expense Reports" },
    ],
  },
  { pattern: "/accounting", crumbs: [{ label: "Accounting" }] },
  {
    pattern: "/accounting/analytics",
    crumbs: [
      { label: "Accounting", href: "/accounting" },
      { label: "Analytics" },
    ],
  },
  {
    pattern: "/accounting/reports",
    crumbs: [
      { label: "Accounting", href: "/accounting" },
      { label: "Expense Reports" },
    ],
  },
  {
    pattern: "/accounting/reports/:id",
    crumbs: [
      { label: "Accounting", href: "/accounting" },
      { label: "Expense Reports", href: "/accounting/reports" },
      { label: REPORT },
    ],
  },
];

/** Returns the matched :id ("" if the pattern has none), or null if no match. */
function matchPattern(pattern: string, path: string): string | null {
  const pSeg = pattern.split("/").filter(Boolean);
  const aSeg = path.split("/").filter(Boolean);
  if (pSeg.length !== aSeg.length) return null;
  let id = "";
  for (let i = 0; i < pSeg.length; i++) {
    if (pSeg[i] === ":id") {
      id = aSeg[i];
      continue;
    }
    if (pSeg[i] !== aSeg[i]) return null;
  }
  return id;
}

const titleCase = (seg: string) =>
  seg
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** Fallback trail for routes not in the map: title-cased cumulative segments. */
function fallbackCrumbs(path: string): Crumb[] {
  const segs = path.split("/").filter(Boolean);
  return segs.map((seg, i) => ({
    label: titleCase(seg),
    href: "/" + segs.slice(0, i + 1).join("/"),
  }));
}

function resolveTrail(path: string): { crumbs: Crumb[]; reportId?: string } {
  for (const { pattern, crumbs } of TRAILS) {
    const id = matchPattern(pattern, path);
    if (id !== null) return { crumbs, reportId: id || undefined };
  }
  return { crumbs: fallbackCrumbs(path) };
}

export function Breadcrumbs() {
  const pathname = usePathname() || "/dashboard";
  const { crumbs, reportId } = React.useMemo(
    () => resolveTrail(pathname),
    [pathname]
  );

  const needsReport = crumbs.some((c) => c.label === REPORT) && !!reportId;
  const reportQuery = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId as string),
    enabled: needsReport,
  });
  const reportName = reportQuery.data?.reportName ?? "Report";

  const items: Crumb[] = [
    { label: "Home", href: "/dashboard" },
    ...crumbs.map((c) => ({
      label: c.label === REPORT ? reportName : c.label,
      href: c.href,
    })),
  ];

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const isHome = i === 0;
          const content = (
            <>
              {isHome && <Home className="size-3.5 shrink-0" />}
              <span className="truncate">{item.label}</span>
            </>
          );
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground/50"
                  aria-hidden
                />
              )}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1",
                    isLast && "font-medium text-foreground"
                  )}
                >
                  {content}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                >
                  {content}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
