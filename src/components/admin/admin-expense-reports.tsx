"use client";

// Admin → Expense Reports: full table of all reports with Change Status + Delete Draft actions.
// No export buttons, no Mark as Paid. Status is always read-only (pill).

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Edit2,
  Loader2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  adminChangeReportStatus,
  adminDeleteReport,
  getAccountingReports,
  getUsers,
} from "@/lib/data";
import { toastQueuedNotifications } from "@/lib/notify";
import { dashboardKeys } from "@/components/dashboard/use-dashboard-data";
import { useSession } from "@/lib/auth/mock-session";
import type { AccountingReportRow, ReportStatus, User } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const REPORT_STATUSES: ReportStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "ACCOUNTING_REVIEW",
  "EXECUTIVE_REVIEW",
  "APPROVED",
  "REJECTED",
  "PAID",
];

const STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "IN_REVIEW", label: "In Review" },
  { value: "ACCOUNTING_REVIEW", label: "Accounting Review" },
  { value: "EXECUTIVE_REVIEW", label: "Executive Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "PAID", label: "Paid" },
];

interface PeopleFilter {
  personId: string;
  from: string;
  to: string;
}

const EMPTY_FILTER: PeopleFilter = { personId: "", from: "", to: "" };

function toggleStatus(list: ReportStatus[], s: ReportStatus): ReportStatus[] {
  return list.includes(s) ? list.filter((x) => x !== s) : [...list, s];
}

function StatusChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

function periodOverlaps(from: string, to: string, filter: PeopleFilter): boolean {
  if (filter.from && to < filter.from) return false;
  if (filter.to && from > filter.to) return false;
  return true;
}

function matchesPerson(submitterId: string, paidToId: string, filter: PeopleFilter): boolean {
  if (!filter.personId) return true;
  return submitterId === filter.personId || paidToId === filter.personId;
}

type SortKey =
  | "id"
  | "reportName"
  | "submitter"
  | "paidTo"
  | "department"
  | "period"
  | "total"
  | "status";

interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

function sortValue(row: AccountingReportRow, key: SortKey): string | number {
  switch (key) {
    case "id":
      return row.report.id;
    case "reportName":
      return row.report.reportName.toLowerCase();
    case "submitter":
      return row.submitterName.toLowerCase();
    case "paidTo":
      return row.paidToName.toLowerCase();
    case "department":
      return row.department.toLowerCase();
    case "period":
      return row.report.periodFrom;
    case "total":
      return row.report.totalAmount;
    case "status":
      return row.report.status;
  }
}

function SortableHeader({
  label,
  sortKey,
  sort,
  onSort,
  align,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
  align?: "right";
}) {
  const active = sort.key === sortKey;
  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex items-center gap-1 font-medium whitespace-nowrap transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {label}
        {active ? (
          sort.dir === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ChevronsUpDown className="size-3.5 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

export function AdminExpenseReports() {
  const { user } = useSession();
  const router = useRouter();
  const qc = useQueryClient();

  const [filter, setFilter] = React.useState<PeopleFilter>(EMPTY_FILTER);
  const [statuses, setStatuses] = React.useState<ReportStatus[]>([]);
  const [sort, setSort] = React.useState<SortState>({ key: "id", dir: "asc" });

  const [changingRow, setChangingRow] = React.useState<AccountingReportRow | null>(null);
  const [newStatus, setNewStatus] = React.useState<ReportStatus>("SUBMITTED");
  const [changeReason, setChangeReason] = React.useState("");

  const [deletingRow, setDeletingRow] = React.useState<AccountingReportRow | null>(null);
  const [deleteReason, setDeleteReason] = React.useState("");

  const reports = useQuery({
    queryKey: ["accounting-reports"],
    queryFn: () => getAccountingReports(),
  });
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers });

  const changeStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: ReportStatus;
      reason: string;
    }) => adminChangeReportStatus(id, user.id, status, reason),
    onSuccess: (result) => {
      toastQueuedNotifications(result.notifications);
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["accounting-reports"] });
      qc.invalidateQueries({ queryKey: ["report-changes"] });
      qc.invalidateQueries({ queryKey: dashboardKeys.all });
      setChangingRow(null);
      setChangeReason("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminDeleteReport(id, user.id, reason || undefined),
    onSuccess: (result) => {
      toastQueuedNotifications(result.notifications);
      const msg =
        result.receiptsReturned > 0
          ? `Report deleted. ${result.receiptsReturned} receipt(s) returned to gallery.`
          : "Report deleted.";
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ["accounting-reports"] });
      qc.invalidateQueries({ queryKey: dashboardKeys.all });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      setDeletingRow(null);
      setDeleteReason("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const onSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );

  const hasFilter =
    Boolean(filter.personId || filter.from || filter.to) || statuses.length > 0;

  const rows = React.useMemo(() => {
    const filtered = (reports.data ?? []).filter(
      (r) =>
        matchesPerson(r.report.submitterId, r.report.paidToId, filter) &&
        periodOverlaps(r.report.periodFrom, r.report.periodTo, filter) &&
        (statuses.length === 0 || statuses.includes(r.report.status))
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [reports.data, filter, statuses, sort]);

  const userList: User[] = users.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header>
        <h1>Expense Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Change any report&apos;s status or delete draft reports.
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Person (submitter or paid-to)
          <select
            className={cn(SELECT_CLASS, "w-56")}
            value={filter.personId}
            onChange={(e) => setFilter({ ...filter, personId: e.target.value })}
          >
            <option value="">All people</option>
            {userList.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Period from
          <Input
            type="date"
            value={filter.from}
            onChange={(e) => setFilter({ ...filter, from: e.target.value })}
            className="w-auto"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Period to
          <Input
            type="date"
            value={filter.to}
            onChange={(e) => setFilter({ ...filter, to: e.target.value })}
            className="w-auto"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_STATUSES.map((s) => (
              <StatusChip
                key={s}
                active={statuses.includes(s)}
                onClick={() => setStatuses(toggleStatus(statuses, s))}
              >
                {s}
              </StatusChip>
            ))}
          </div>
        </div>
        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setFilter(EMPTY_FILTER);
              setStatuses([]);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader label="Report ID" sortKey="id" sort={sort} onSort={onSort} />
              <SortableHeader label="Report Name" sortKey="reportName" sort={sort} onSort={onSort} />
              <SortableHeader label="Submitter" sortKey="submitter" sort={sort} onSort={onSort} />
              <SortableHeader label="Paid To" sortKey="paidTo" sort={sort} onSort={onSort} />
              <SortableHeader label="Department" sortKey="department" sort={sort} onSort={onSort} />
              <SortableHeader label="Period" sortKey="period" sort={sort} onSort={onSort} />
              <SortableHeader label="Total" sortKey="total" sort={sort} onSort={onSort} align="right" />
              <SortableHeader label="Status" sortKey="status" sort={sort} onSort={onSort} />
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No reports match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const { report, submitterName, paidToName, department } = row;
                return (
                  <TableRow
                    key={report.id}
                    onClick={() => router.push(`/reports/${report.id}/view`)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {report.id}
                    </TableCell>
                    <TableCell className="font-medium">{report.reportName}</TableCell>
                    <TableCell>{submitterName}</TableCell>
                    <TableCell>{paidToName}</TableCell>
                    <TableCell>{department}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(report.periodFrom)} – {formatDate(report.periodTo)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(report.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <StatusPill status={report.status} />
                    </TableCell>
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Change status"
                          aria-label="Change status"
                          onClick={() => {
                            setChangingRow(row);
                            setNewStatus(report.status);
                            setChangeReason("");
                          }}
                        >
                          <Edit2 className="size-4" />
                        </Button>
                        {report.status === "DRAFT" && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete draft"
                            aria-label="Delete draft"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => {
                              setDeletingRow(row);
                              setDeleteReason("");
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Change Status Dialog */}
      <Dialog
        open={changingRow !== null}
        onOpenChange={(o) => !o && !changeStatusMutation.isPending && setChangingRow(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change report status</DialogTitle>
            <DialogDescription>
              &ldquo;{changingRow?.report.reportName}&rdquo; — select a new status and
              provide a reason. The submitter will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              New status
              <select
                className={SELECT_CLASS}
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as ReportStatus)}
                disabled={changeStatusMutation.isPending}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Reason <span className="font-normal text-muted-foreground">(required)</span>
              <Textarea
                placeholder="Explain why this status change is necessary…"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                disabled={changeStatusMutation.isPending}
                rows={3}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChangingRow(null)}
              disabled={changeStatusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              disabled={
                !changeReason.trim() ||
                newStatus === changingRow?.report.status ||
                changeStatusMutation.isPending
              }
              onClick={() =>
                changingRow &&
                changeStatusMutation.mutate({
                  id: changingRow.report.id,
                  status: newStatus,
                  reason: changeReason.trim(),
                })
              }
            >
              {changeStatusMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Confirm change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Draft Dialog */}
      <Dialog
        open={deletingRow !== null}
        onOpenChange={(o) => !o && !deleteMutation.isPending && setDeletingRow(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete draft report?</DialogTitle>
            <DialogDescription>
              &ldquo;{deletingRow?.report.reportName}&rdquo; will be permanently deleted.
              Any attached receipts are returned to the gallery. The submitter will be
              notified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Reason <span className="font-normal text-muted-foreground">(optional)</span>
              <Textarea
                placeholder="Reason for deletion…"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                disabled={deleteMutation.isPending}
                rows={3}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingRow(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deletingRow &&
                deleteMutation.mutate({
                  id: deletingRow.report.id,
                  reason: deleteReason.trim() || undefined,
                })
              }
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
