"use client";

// Read-only report detail layout: header, line items with receipt thumbnails,
// and the approval-history timeline. Shared by the approval review screen and
// the accounting read-only view so both render an identical report.

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, History, Pencil, XCircle } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  getApprovalGroups,
  getExpenseTypes,
  getReceipts,
  getReport,
  getReportChangeLogs,
  getUsers,
} from "@/lib/data";
import type { ApprovalAction, ExpenseType, Receipt, ReportChangeLog } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";
import { ChangeHistoryButton } from "@/components/reports/report-change-history";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ReceiptThumb } from "@/components/reports/receipt-thumb";

const SELECT_CLASS =
  "h-8 w-full min-w-[10rem] rounded-lg border border-input bg-background text-foreground px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function HeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

const ACTION_META: Record<
  ApprovalAction,
  { icon: typeof Clock; className: string; label: string }
> = {
  PENDING: { icon: Clock, className: "text-amber-600", label: "Pending" },
  APPROVED: {
    icon: CheckCircle2,
    className: "text-green-600",
    label: "Approved",
  },
  REJECTED: { icon: XCircle, className: "text-red-600", label: "Rejected" },
};

export function ReportDetailView({
  reportId,
  actions,
  midContent,
  footer,
  reserveBottomSpace = false,
  onReclassify,
  onSaveOtherLineGl,
}: {
  reportId: string;
  /** Right-aligned header slot (e.g. export buttons). */
  actions?: React.ReactNode;
  /** Rendered between line items and approval history (e.g. rejection log). */
  midContent?: React.ReactNode;
  /** Rendered after the content (e.g. a sticky decision panel). */
  footer?: React.ReactNode;
  /** Adds extra bottom padding so a fixed footer doesn't cover content. */
  reserveBottomSpace?: boolean;
  /**
   * When provided (accounting/admin views only), renders inline expense-type
   * reclassification UI on each line item row.
   */
  onReclassify?: (lineItemId: string, newTypeId: string, reason: string) => Promise<void>;
  /**
   * When provided (accounting/admin views only), renders inline GL Code + GL Name
   * inputs for Other-type line items.
   */
  onSaveOtherLineGl?: (lineItemId: string, glCode: string, glName: string) => Promise<void>;
}) {
  const reportQuery = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId),
  });
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const typesQuery = useQuery({
    queryKey: ["expense-types"],
    queryFn: getExpenseTypes,
  });
  const receiptsQuery = useQuery({
    queryKey: ["all-receipts"],
    queryFn: () => getReceipts(),
  });
  const groupsQuery = useQuery({
    queryKey: ["approval-groups"],
    queryFn: getApprovalGroups,
  });
  const changeLogsQuery = useQuery({
    queryKey: ["report-change-log", reportId],
    queryFn: () => getReportChangeLogs(reportId),
  });

  const queryClient = useQueryClient();
  const [lightbox, setLightbox] = React.useState<Receipt | null>(null);

  // ---- reclassify inline edit state ----
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draftTypeId, setDraftTypeId] = React.useState("");
  const [draftReason, setDraftReason] = React.useState("");
  const [reclassifySaving, setReclassifySaving] = React.useState(false);

  // ---- GL override inline edit state (Other-type lines, accounting/admin only) ----
  const [glDrafts, setGlDrafts] = React.useState<Map<string, { code: string; name: string }>>(
    new Map()
  );
  const [glSaving, setGlSaving] = React.useState<string | null>(null);

  const getGlDraft = (li: { id: string; glCodeOverride?: string; glNameOverride?: string }) =>
    glDrafts.get(li.id) ?? { code: li.glCodeOverride ?? "", name: li.glNameOverride ?? "" };

  const setGlDraft = (liId: string, code: string, name: string) =>
    setGlDrafts((prev) => new Map(prev).set(liId, { code, name }));

  const handleSaveGl = async (liId: string, code: string, name: string) => {
    if (!onSaveOtherLineGl) return;
    setGlSaving(liId);
    try {
      await onSaveOtherLineGl(liId, code, name);
      queryClient.invalidateQueries({ queryKey: ["report", reportId] });
      setGlDrafts((prev) => {
        const next = new Map(prev);
        next.delete(liId);
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save GL");
    } finally {
      setGlSaving(null);
    }
  };

  const startEdit = (lineItemId: string, currentTypeId: string) => {
    setEditingId(lineItemId);
    setDraftTypeId(currentTypeId);
    setDraftReason("");
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraftTypeId("");
    setDraftReason("");
  };
  const saveEdit = async () => {
    if (!onReclassify || !editingId) return;
    setReclassifySaving(true);
    try {
      await onReclassify(editingId, draftTypeId, draftReason);
      queryClient.invalidateQueries({ queryKey: ["report", reportId] });
      cancelEdit();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reclassify failed");
    } finally {
      setReclassifySaving(false);
    }
  };

  const nameById = new Map((usersQuery.data ?? []).map((u) => [u.id, u.name]));
  const groupNameById = new Map(
    (groupsQuery.data ?? []).map((g) => [g.group.id, g.group.name])
  );
  const allTypes: ExpenseType[] = typesQuery.data ?? [];
  const typeName = new Map(allTypes.map((t) => [t.id, t.displayName]));
  const otherTypeId = allTypes.find((t) => !t.isMileage && t.displayName === "Other")?.id;
  const receiptById = new Map((receiptsQuery.data ?? []).map((r) => [r.id, r]));

  // Map each reclassified line-item ID to its matching change-log entry so the
  // UI can show the old type name and the reason in the History icon tooltip.
  const reclassifyLogByItemId = React.useMemo(() => {
    const logs = changeLogsQuery.data ?? [];
    const reclass = logs.filter(
      (c) => c.changeType === "FIELD" && c.field === "expenseTypeId"
    );
    return new Map<string, ReportChangeLog>(
      (reportQuery.data?.lineItems ?? [])
        .filter((li) => li.reclassifiedAt && li.reclassifiedById)
        .map((li) => {
          const match =
            reclass.find(
              (c) => c.changedAt === li.reclassifiedAt && c.changedById === li.reclassifiedById
            ) ?? reclass.find((c) => c.changedById === li.reclassifiedById);
          return match ? ([li.id, match] as [string, ReportChangeLog]) : null;
        })
        .filter((e): e is [string, ReportChangeLog] => e !== null)
    );
  }, [changeLogsQuery.data, reportQuery.data?.lineItems]);

  if (reportQuery.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const report = reportQuery.data;
  if (!report) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1>Report not found</h1>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8",
        reserveBottomSpace && "pb-40"
      )}
    >
      {/* Read-only header */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1>{report.reportName}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill status={report.status} />
            <ChangeHistoryButton reportId={reportId} />
            {actions}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4 shadow-sm sm:grid-cols-4">
          <HeaderField
            label="Submitter"
            value={nameById.get(report.submitterId) ?? "—"}
          />
          <HeaderField
            label="Paid To"
            value={nameById.get(report.paidToId) ?? "—"}
          />
          <HeaderField
            label="Period"
            value={`${formatDate(report.periodFrom)} – ${formatDate(
              report.periodTo
            )}`}
          />
          <HeaderField label="Total" value={formatCurrency(report.totalAmount)} />
        </div>
      </header>

      {/* Line items */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Line items</h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-table-header-band font-semibold">
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Receipt</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.lineItems.map((li, liIdx) => {
                const receipt = li.receiptId
                  ? receiptById.get(li.receiptId)
                  : undefined;
                const isEditing = onReclassify && editingId === li.id;
                const rawTypeName = typeName.get(li.expenseTypeId) ?? "—";
                const displayTypeName =
                  li.expenseTypeId === otherTypeId && li.otherDescription
                    ? `Other — ${li.otherDescription}`
                    : rawTypeName;
                return (
                  <React.Fragment key={li.id}>
                    <TableRow
                      className={cn(
                        "border-b border-table-row-divider",
                        liIdx % 2 === 0 ? "bg-table-row-band" : "bg-background"
                      )}
                    >
                      <TableCell className="text-muted-foreground">
                        {formatDate(li.expenseDate)}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <select
                            className={SELECT_CLASS}
                            value={draftTypeId}
                            onChange={(e) => setDraftTypeId(e.target.value)}
                            disabled={reclassifySaving}
                          >
                            {allTypes.filter((t) => !t.isMileage && t.isActive).map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.displayName}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            {displayTypeName}
                            {li.reclassifiedAt && (() => {
                              const log = reclassifyLogByItemId.get(li.id);
                              const who = li.reclassifiedById ? (nameById.get(li.reclassifiedById) ?? "Accounting") : "Accounting";
                              const when = formatDate(li.reclassifiedAt);
                              const was = log?.oldValue ? `was: ${log.oldValue}` : "";
                              const reason = log?.note ? `Reason: ${log.note}` : "";
                              const tooltip = [
                                `Reclassified by ${who} on ${when}`,
                                was,
                                reason,
                              ].filter(Boolean).join(" — ");
                              return (
                                <span
                                  className="inline-flex shrink-0 cursor-help text-amber-600 dark:text-amber-400"
                                  title={tooltip}
                                  aria-label={tooltip}
                                >
                                  <History className="size-3" />
                                </span>
                              );
                            })()}
                            {onReclassify && !editingId && (
                              <button
                                type="button"
                                onClick={() => startEdit(li.id, li.expenseTypeId)}
                                className="ml-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                                aria-label={`Reclassify line ${liIdx + 1}`}
                              >
                                <Pencil className="size-3" />
                              </button>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{li.description}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[li.city, li.state, li.country].filter(Boolean).join(", ")}
                      </TableCell>
                      <TableCell>
                        {receipt ? (
                          <button
                            type="button"
                            onClick={() => setLightbox(receipt)}
                            className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            aria-label="Enlarge receipt"
                          >
                            <ReceiptThumb receipt={receipt} className="size-10" />
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(li.amount)}
                      </TableCell>
                    </TableRow>
                    {isEditing && (
                      <TableRow className={liIdx % 2 === 0 ? "bg-table-row-band" : "bg-background"}>
                        <TableCell colSpan={6} className="px-4 pb-3 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              className="h-8 flex-1 min-w-[12rem]"
                              placeholder="Reason (optional)"
                              value={draftReason}
                              onChange={(e) => setDraftReason(e.target.value)}
                              disabled={reclassifySaving}
                            />
                            <Button
                              size="sm"
                              onClick={saveEdit}
                              disabled={reclassifySaving || draftTypeId === li.expenseTypeId}
                            >
                              {reclassifySaving ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={cancelEdit}
                              disabled={reclassifySaving}
                            >
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    {onSaveOtherLineGl && li.expenseTypeId === otherTypeId && !isEditing && (() => {
                      const draft = getGlDraft(li);
                      const stored = { code: li.glCodeOverride ?? "", name: li.glNameOverride ?? "" };
                      const isDirty = draft.code !== stored.code || draft.name !== stored.name;
                      const isSavingThis = glSaving === li.id;
                      return (
                        <TableRow className={liIdx % 2 === 0 ? "bg-table-row-band" : "bg-background"}>
                          <TableCell colSpan={6} className="px-4 pb-3 pt-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                                GL →
                              </span>
                              <Input
                                className="h-8 w-36 font-mono"
                                placeholder="e.g. MR5100502100"
                                maxLength={30}
                                value={draft.code}
                                onChange={(e) => setGlDraft(li.id, e.target.value, draft.name)}
                                disabled={isSavingThis}
                              />
                              <Input
                                className="h-8 flex-1 min-w-[12rem]"
                                placeholder="e.g. Conferences Other"
                                maxLength={255}
                                value={draft.name}
                                onChange={(e) => setGlDraft(li.id, draft.code, e.target.value)}
                                disabled={isSavingThis}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveGl(li.id, draft.code, draft.name)}
                                disabled={!isDirty || isSavingThis}
                              >
                                {isSavingThis ? "Saving…" : "Save GL"}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })()}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {midContent}

      {/* Approval history timeline */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Approval history
        </h2>
        {report.approvalHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {report.approvalHistory.map((h) => {
              const meta = ACTION_META[h.action];
              const Icon = meta.icon;
              return (
                <li key={h.id} className="flex gap-3">
                  <Icon className={cn("mt-0.5 size-5 shrink-0", meta.className)} />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{meta.label}</span>
                      {" · "}
                      <span className="text-muted-foreground">
                        {h.approvalGroupId
                          ? `${groupNameById.get(h.approvalGroupId) ?? "Group"}${
                              h.approverId
                                ? ` (${nameById.get(h.approverId) ?? "—"})`
                                : ""
                            }`
                          : nameById.get(h.approverId) ?? "System"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(h.createdAt)}
                    </p>
                    {h.comment && (
                      <p className="mt-1 rounded-md bg-muted/60 px-2 py-1 text-sm">
                        {h.comment}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {footer}

      {/* Receipt lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{lightbox?.merchantName ?? "Receipt"}</DialogTitle>
          </DialogHeader>
          {lightbox && (
            <ReceiptThumb receipt={lightbox} className="max-h-[70vh] w-full" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
