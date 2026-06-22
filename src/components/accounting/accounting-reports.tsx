"use client";

// Accounting → Reports, organized into three tabs:
//   1. Reports          — sortable, filterable payable-report listing (row opens
//                          a read-only detail; per-row PDF/Excel + Mark as Paid).
//   2. Expense-Type      — spend grouped by expense type (GL code/name gated).
//   3. Duplicate         — AI duplicate detection.
// Tabs 1 & 2 share a Person + Period filter.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  FileSpreadsheet,
  FileText,
  Loader2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  getAccountingReports,
  getExpenseTypes,
  getLedgerEntries,
  getReceipts,
  getReport,
  getReportChanges,
  getUsers,
  markPaid,
} from "@/lib/data";
import { exportReportToExcel } from "@/lib/export/excel";
import { toastQueuedNotifications } from "@/lib/notify";
import { dashboardKeys } from "@/components/dashboard/use-dashboard-data";
import { useSession } from "@/lib/auth/mock-session";
import type {
  AccountingReportRow,
  ExpenseReport,
  ExpenseType,
  Receipt,
  ReportChangeLogRow,
  ReportChangeType,
  ReportStatus,
  User,
} from "@/lib/types";
import { ChangeHistoryDialog } from "@/components/reports/report-change-history";
import { PdfViewerDialog } from "@/components/reports/pdf-viewer-dialog";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
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

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// Same set + order as the Analytics status filter, for consistency.
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

interface PeopleFilter {
  personId: string;
  from: string;
  to: string;
}

const EMPTY_FILTER: PeopleFilter = { personId: "", from: "", to: "" };

/** Toggle a status in/out of a multi-select list. */
function toggleStatus(
  list: ReportStatus[],
  status: ReportStatus
): ReportStatus[] {
  return list.includes(status)
    ? list.filter((s) => s !== status)
    : [...list, status];
}

/** Chip toggle matching the Analytics status filter. */
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

/** Whether a report period [from, to] overlaps the filter range. */
function periodOverlaps(
  periodFrom: string,
  periodTo: string,
  filter: PeopleFilter
): boolean {
  if (filter.from && periodTo < filter.from) return false;
  if (filter.to && periodFrom > filter.to) return false;
  return true;
}

function matchesPerson(
  submitterId: string,
  paidToId: string,
  filter: PeopleFilter
): boolean {
  if (!filter.personId) return true;
  return submitterId === filter.personId || paidToId === filter.personId;
}

/** Expense Reports list with person/period/status filters. */
export function AccountingReports() {
  const { role } = useSession();
  const showCodes = role === "ADMIN" || role === "ACCOUNTING";
  const [filter, setFilter] = React.useState<PeopleFilter>(EMPTY_FILTER);
  const [statuses, setStatuses] = React.useState<ReportStatus[]>([]);
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers });

  return (
    <div className="flex flex-col gap-4">
      <ReportFilters
        filter={filter}
        onChange={setFilter}
        users={users.data ?? []}
        statuses={statuses}
        onStatusChange={setStatuses}
      />
      <ReportsTab filter={filter} statuses={statuses} showCodes={showCodes} />
    </div>
  );
}

/** Expense-Type Summary with person/period filters. */
export function AccountingExpenseTypeSummary() {
  const { role } = useSession();
  const showCodes = role === "ADMIN" || role === "ACCOUNTING";
  const [filter, setFilter] = React.useState<PeopleFilter>(EMPTY_FILTER);
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers });

  return (
    <div className="flex flex-col gap-4">
      <ReportFilters filter={filter} onChange={setFilter} users={users.data ?? []} />
      <ExpenseTypeSummaryTab filter={filter} showCodes={showCodes} />
    </div>
  );
}

/** Change Log with person/period filters. */
export function AccountingChangeLog() {
  const [filter, setFilter] = React.useState<PeopleFilter>(EMPTY_FILTER);
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers });

  return (
    <div className="flex flex-col gap-4">
      <ReportFilters filter={filter} onChange={setFilter} users={users.data ?? []} />
      <ChangeLogTab filter={filter} />
    </div>
  );
}

// ---------------- Shared filters ----------------

function ReportFilters({
  filter,
  onChange,
  users,
  statuses,
  onStatusChange,
}: {
  filter: PeopleFilter;
  onChange: (f: PeopleFilter) => void;
  users: User[];
  /** When provided, render the status multi-select alongside person/period. */
  statuses?: ReportStatus[];
  onStatusChange?: (s: ReportStatus[]) => void;
}) {
  const showStatus = statuses !== undefined && onStatusChange !== undefined;
  const hasActive =
    Boolean(filter.personId || filter.from || filter.to) ||
    (statuses?.length ?? 0) > 0;

  const clearAll = () => {
    onChange(EMPTY_FILTER);
    onStatusChange?.([]);
  };

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border p-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Person (submitter or paid-to)
        <select
          className={cn(SELECT_CLASS, "w-56")}
          value={filter.personId}
          onChange={(e) => onChange({ ...filter, personId: e.target.value })}
        >
          <option value="">All people</option>
          {users.map((u) => (
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
          onChange={(e) => onChange({ ...filter, from: e.target.value })}
          className="w-auto"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Period to
        <Input
          type="date"
          value={filter.to}
          onChange={(e) => onChange({ ...filter, to: e.target.value })}
          className="w-auto"
        />
      </label>
      {showStatus && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <div className="flex flex-wrap gap-1.5">
            {REPORT_STATUSES.map((s) => (
              <StatusChip
                key={s}
                active={statuses!.includes(s)}
                onClick={() => onStatusChange!(toggleStatus(statuses!, s))}
              >
                {s}
              </StatusChip>
            ))}
          </div>
        </div>
      )}
      {hasActive && (
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={clearAll}
        >
          Clear
        </Button>
      )}
    </div>
  );
}

// ---------------- Tab 1: Reports ----------------

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

function ReportsTab({
  filter,
  statuses,
  showCodes,
}: {
  filter: PeopleFilter;
  statuses: ReportStatus[];
  showCodes: boolean;
}) {
  const router = useRouter();
  const qc = useQueryClient();

  const reports = useQuery({
    queryKey: ["accounting-reports"],
    queryFn: () => getAccountingReports(),
  });
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const types = useQuery({ queryKey: ["expense-types"], queryFn: getExpenseTypes });
  const receipts = useQuery({
    queryKey: ["all-receipts"],
    queryFn: () => getReceipts(),
  });

  const usersById = new Map((users.data ?? []).map((u) => [u.id, u]));
  const typesById = new Map((types.data ?? []).map((t) => [t.id, t]));
  const receiptsById = new Map((receipts.data ?? []).map((r) => [r.id, r]));

  const [sort, setSort] = React.useState<SortState>({ key: "id", dir: "asc" });

  const onSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => markPaid(id),
    onSuccess: (result) => {
      toastQueuedNotifications(result.notifications);
      qc.invalidateQueries({ queryKey: ["accounting-reports"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: dashboardKeys.all });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

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
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [reports.data, filter, statuses, sort]);

  return (
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
            <TableHead className="text-center">Export PDF</TableHead>
            <TableHead className="text-center">Export Excel</TableHead>
            <TableHead className="text-center">Mark as Paid</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 11 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={11}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No reports match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            rows.map(({ report, submitterName, paidToName, department }) => (
              <TableRow
                key={report.id}
                onClick={() => router.push(`/accounting/reports/${report.id}`)}
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
                <RowActionCells
                  report={report}
                  usersById={usersById}
                  typesById={typesById}
                  receiptsById={receiptsById}
                  includeGlColumns={showCodes}
                  onMarkPaid={() => markPaidMutation.mutate(report.id)}
                  markPaidPending={
                    markPaidMutation.isPending &&
                    markPaidMutation.variables === report.id
                  }
                />
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
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

function RowActionCells({
  report,
  usersById,
  typesById,
  receiptsById,
  includeGlColumns,
  onMarkPaid,
  markPaidPending,
}: {
  report: ExpenseReport;
  usersById: Map<string, User>;
  typesById: Map<string, ExpenseType>;
  receiptsById: Map<string, Receipt>;
  includeGlColumns: boolean;
  onMarkPaid: () => void;
  markPaidPending: boolean;
}) {
  const [excelBusy, setExcelBusy] = React.useState(false);
  const [pdfOpen, setPdfOpen] = React.useState(false);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const handleExcel = async () => {
    setExcelBusy(true);
    try {
      const detail = await getReport(report.id);
      if (!detail) throw new Error("Report not found");
      exportReportToExcel({
        report: detail,
        usersById,
        typesById,
        receiptsById,
        includeGlColumns,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExcelBusy(false);
    }
  };

  return (
    <>
      <PdfViewerDialog
        reportId={report.id}
        open={pdfOpen}
        onOpenChange={setPdfOpen}
      />
      <TableCell className="text-center" onClick={stop}>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Export PDF"
          aria-label="Export PDF"
          onClick={() => {
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              window.open(`/reports/${report.id}/print`, "_blank");
            } else {
              setPdfOpen(true);
            }
          }}
        >
          <FileText className="size-4" />
        </Button>
      </TableCell>
      <TableCell className="text-center" onClick={stop}>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Export Excel"
          aria-label="Export Excel"
          onClick={handleExcel}
          disabled={excelBusy}
        >
          {excelBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="size-4" />
          )}
        </Button>
      </TableCell>
      <TableCell className="text-center" onClick={stop}>
        <Button
          size="sm"
          className="bg-green-600 text-white hover:bg-green-700"
          disabled={report.status !== "APPROVED" || markPaidPending}
          onClick={onMarkPaid}
          title={
            report.status === "APPROVED"
              ? "Mark as paid"
              : "Only approved reports can be paid"
          }
        >
          {markPaidPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Wallet className="size-4" />
          )}
          Mark Paid
        </Button>
      </TableCell>
    </>
  );
}

// ---------------- Tab 2: Expense-Type Summary ----------------

function ExpenseTypeSummaryTab({
  filter,
  showCodes,
}: {
  filter: PeopleFilter;
  showCodes: boolean;
}) {
  const ledger = useQuery({
    queryKey: ["ledger"],
    queryFn: () => getLedgerEntries(),
  });

  const summary = React.useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        glCode: string;
        glName: string;
        total: number;
        reportIds: Set<string>;
      }
    >();
    for (const e of ledger.data ?? []) {
      if (!matchesPerson(e.submitterId, e.paidToId, filter)) continue;
      if (!periodOverlaps(e.periodFrom, e.periodTo, filter)) continue;
      const cur =
        map.get(e.expenseTypeId) ?? {
          name: e.expenseTypeName,
          glCode: e.glCode,
          glName: e.glName,
          total: 0,
          reportIds: new Set<string>(),
        };
      cur.total += e.amount;
      cur.reportIds.add(e.reportId);
      map.set(e.expenseTypeId, cur);
    }
    return [...map.values()]
      .map((s) => ({
        name: s.name,
        glCode: s.glCode,
        glName: s.glName,
        total: s.total,
        count: s.reportIds.size,
      }))
      .sort((a, b) => b.total - a.total);
  }, [ledger.data, filter]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Expense Type</TableHead>
            {showCodes && <TableHead>GL Code</TableHead>}
            {showCodes && <TableHead>GL Name</TableHead>}
            <TableHead className="text-right">Report Count</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ledger.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: showCodes ? 5 : 3 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : summary.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={showCodes ? 5 : 3}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No expenses match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            summary.map((s) => (
              <TableRow key={s.name}>
                <TableCell className="font-medium">{s.name}</TableCell>
                {showCodes && (
                  <TableCell className="tabular-nums">{s.glCode}</TableCell>
                )}
                {showCodes && <TableCell>{s.glName}</TableCell>}
                <TableCell className="text-right tabular-nums">{s.count}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(s.total)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

// ---------------- Tab 4: Change Log ----------------

const CHANGE_TYPE_LABEL: Record<ReportChangeType, string> = {
  STATUS: "Status",
  AMOUNT: "Amount",
  LINE_ITEM: "Line item",
  FIELD: "Field",
  OTHER: "Other",
};

type ChangeSortKey = "date" | "reportId" | "reportName" | "type" | "changedBy";

function changeSortValue(row: ReportChangeLogRow, key: ChangeSortKey): string {
  switch (key) {
    case "date":
      return row.change.changedAt;
    case "reportId":
      return row.change.reportId;
    case "reportName":
      return row.reportName.toLowerCase();
    case "type":
      return row.change.changeType;
    case "changedBy":
      return row.changedByName.toLowerCase();
  }
}

function ChangeSortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: ChangeSortKey;
  sort: { key: ChangeSortKey; dir: "asc" | "desc" };
  onSort: (key: ChangeSortKey) => void;
}) {
  const active = sort.key === sortKey;
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex items-center gap-1 font-medium whitespace-nowrap transition-colors hover:text-foreground",
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

function ChangeLogTab({ filter }: { filter: PeopleFilter }) {
  const changes = useQuery({
    queryKey: ["report-changes"],
    queryFn: getReportChanges,
  });

  const [sort, setSort] = React.useState<{
    key: ChangeSortKey;
    dir: "asc" | "desc";
  }>({ key: "date", dir: "desc" });
  const [openReportId, setOpenReportId] = React.useState<string | null>(null);

  const onSort = (key: ChangeSortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );

  const rows = React.useMemo(() => {
    const filtered = (changes.data ?? []).filter(
      (r) =>
        matchesPerson(r.submitterId, r.paidToId, filter) &&
        periodOverlaps(r.periodFrom, r.periodTo, filter)
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort(
      (a, b) =>
        changeSortValue(a, sort.key).localeCompare(
          changeSortValue(b, sort.key)
        ) * dir
    );
  }, [changes.data, filter, sort]);

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <ChangeSortHeader label="Date & Time" sortKey="date" sort={sort} onSort={onSort} />
              <ChangeSortHeader label="Report ID" sortKey="reportId" sort={sort} onSort={onSort} />
              <ChangeSortHeader label="Report Name" sortKey="reportName" sort={sort} onSort={onSort} />
              <ChangeSortHeader label="Type of Change" sortKey="type" sort={sort} onSort={onSort} />
              <ChangeSortHeader label="Changed By" sortKey="changedBy" sort={sort} onSort={onSort} />
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No changes match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={r.change.id}
                  onClick={() => setOpenReportId(r.change.reportId)}
                  className="cursor-pointer"
                >
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(r.change.changedAt)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.change.reportId}
                  </TableCell>
                  <TableCell className="font-medium">{r.reportName}</TableCell>
                  <TableCell>{CHANGE_TYPE_LABEL[r.change.changeType]}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.changedByName}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="text-sm">{r.change.summary}</span>
                    {r.change.oldValue != null &&
                      r.change.newValue != null && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({r.change.oldValue} → {r.change.newValue})
                        </span>
                      )}
                    {r.change.note && (
                      <span className="mt-0.5 block text-xs text-muted-foreground italic">
                        Reason: {r.change.note}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ChangeHistoryDialog
        reportId={openReportId}
        open={openReportId !== null}
        onOpenChange={(o) => !o && setOpenReportId(null)}
      />
    </>
  );
}
