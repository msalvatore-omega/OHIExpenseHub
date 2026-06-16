"use client";

// AI duplicate detection (mocked via detectDuplicates()). Pick a date range +
// sensitivity, run the analysis, and review confidence-scored groups.

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, FileSpreadsheet, Loader2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { getLineItemDetails } from "@/lib/data";
import { detectDuplicates } from "@/lib/data/duplicates";
import { exportDuplicatesToExcel } from "@/lib/export/excel";
import type {
  DuplicateConfidence,
  DuplicateGroup,
  DuplicateSensitivity,
  LedgerEntry,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SENSITIVITY: { label: string; value: DuplicateSensitivity }[] = [
  { label: "Conservative", value: "LOW" },
  { label: "Balanced", value: "MEDIUM" },
  { label: "Aggressive", value: "HIGH" },
];

const CONFIDENCE_COLOR: Record<DuplicateConfidence, string> = {
  HIGH: "var(--danger)",
  MEDIUM: "var(--warning)",
  LOW: "var(--muted-foreground)",
};

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function ConfidenceBadge({ confidence }: { confidence: DuplicateConfidence }) {
  const color = CONFIDENCE_COLOR[confidence];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{
        color: `color-mix(in srgb, ${color} 60%, var(--foreground))`,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
    >
      {confidence} confidence
    </span>
  );
}

export function DuplicateDetection() {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [sensitivity, setSensitivity] =
    React.useState<DuplicateSensitivity>("MEDIUM");
  const [groups, setGroups] = React.useState<DuplicateGroup[] | null>(null);
  const [detailsById, setDetailsById] = React.useState<Map<string, LedgerEntry>>(
    new Map()
  );
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const analysis = useMutation({
    mutationFn: async () => {
      const result = await detectDuplicates(
        { from: from || "2000-01-01", to: to || "2100-01-01" },
        sensitivity
      );
      const ids = [...new Set(result.flatMap((g) => g.lineItemIds))];
      const details = await getLineItemDetails(ids);
      return {
        groups: result,
        detailsById: new Map(details.map((d) => [d.lineItemId, d])),
      };
    },
    onSuccess: (data) => {
      setGroups(data.groups);
      setDetailsById(data.detailsById);
      setExpanded(new Set());
    },
  });

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-accent" />
        <h2 className="text-sm font-medium text-muted-foreground">
          AI duplicate detection
        </h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Simulated result
        </span>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          From
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          To
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Sensitivity
          <select
            className={SELECT_CLASS}
            value={sensitivity}
            onChange={(e) => setSensitivity(e.target.value as DuplicateSensitivity)}
          >
            {SENSITIVITY.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <Button onClick={() => analysis.mutate()} disabled={analysis.isPending}>
          {analysis.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Run Analysis
        </Button>
        {groups && groups.length > 0 && (
          <Button
            variant="outline"
            className="ml-auto"
            onClick={() => exportDuplicatesToExcel(groups, detailsById)}
          >
            <FileSpreadsheet className="size-4" />
            Export Duplicate Report
          </Button>
        )}
      </div>

      {/* Results */}
      {analysis.isPending ? (
        <p className="text-sm text-muted-foreground">Analyzing expenses…</p>
      ) : groups === null ? (
        <p className="text-sm text-muted-foreground">
          Run an analysis to surface potential duplicates.
        </p>
      ) : groups.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          No potential duplicates found.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const open = expanded.has(g.duplicateGroupId);
            return (
              <div
                key={g.duplicateGroupId}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <ConfidenceBadge confidence={g.confidence} />
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(g.totalDuplicatedAmount)}
                      </span>
                    </div>
                    <p className="text-sm">{g.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Recommended: {g.recommendedAction}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggle(g.duplicateGroupId)}
                  >
                    {g.lineItemIds.length} items
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform",
                        open && "rotate-180"
                      )}
                    />
                  </Button>
                </div>

                {open && (
                  <div className="mt-3 overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 text-left">
                        <tr>
                          <th className="px-2 py-1.5 font-semibold">Report</th>
                          <th className="px-2 py-1.5 font-semibold">Date</th>
                          <th className="px-2 py-1.5 font-semibold">Type</th>
                          <th className="px-2 py-1.5 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.lineItemIds.map((id) => {
                          const d = detailsById.get(id);
                          return (
                            <tr key={id} className="border-t border-border">
                              <td className="px-2 py-1.5">{d?.reportName ?? id}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">
                                {d ? formatDate(d.expenseDate) : "—"}
                              </td>
                              <td className="px-2 py-1.5">{d?.expenseTypeName ?? "—"}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums">
                                {d ? formatCurrency(d.amount) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
