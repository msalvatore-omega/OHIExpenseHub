"use client";

// Accounting reports: a payable-reports table (PDF/Excel per row + Mark as Paid)
// and an expense-type summary with accounting codes (role-gated).

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { formatCurrency, formatDate } from "@/lib/format";
import {
  getAccountingReports,
  getExpenseTypes,
  getLedgerEntries,
  getReceipts,
  getReport,
  getUsers,
  markPaid,
} from "@/lib/data";
import { exportReportToExcel } from "@/lib/export/excel";
import { toastQueuedNotifications } from "@/lib/notify";
import { dashboardKeys } from "@/components/dashboard/use-dashboard-data";
import { useSession } from "@/lib/auth/mock-session";
import type { ExpenseReport, ExpenseType, Receipt, User } from "@/lib/types";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function AccountingReports() {
  const { role } = useSession();
  const showCodes = role === "ADMIN" || role === "ACCOUNTING";
  const qc = useQueryClient();

  const reports = useQuery({
    queryKey: ["accounting-reports"],
    queryFn: () => getAccountingReports(),
  });
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const types = useQuery({ queryKey: ["expense-types"], queryFn: getExpenseTypes });
  const receipts = useQuery({ queryKey: ["all-receipts"], queryFn: () => getReceipts() });
  const ledger = useQuery({ queryKey: ["ledger"], queryFn: () => getLedgerEntries() });

  const usersById = new Map((users.data ?? []).map((u) => [u.id, u]));
  const typesById = new Map((types.data ?? []).map((t) => [t.id, t]));
  const receiptsById = new Map((receipts.data ?? []).map((r) => [r.id, r]));

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

  // Expense-type summary (across all line items).
  const summary = React.useMemo(() => {
    const map = new Map<string, { name: string; code: string; total: number; count: number }>();
    for (const e of ledger.data ?? []) {
      const cur = map.get(e.expenseTypeId) ?? {
        name: e.expenseTypeName,
        code: e.accountingCode,
        total: 0,
        count: 0,
      };
      cur.total += e.amount;
      cur.count += 1;
      map.set(e.expenseTypeId, cur);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [ledger.data]);

  return (
    <div className="flex flex-col gap-8">
      {/* Reports table */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Reports</h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Submitter</TableHead>
                <TableHead>Paid To</TableHead>
                <TableHead>Dept</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (reports.data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-sm text-muted-foreground">
                    No reports.
                  </TableCell>
                </TableRow>
              ) : (
                (reports.data ?? []).map(({ report, submitterName, paidToName, department }) => (
                  <TableRow key={report.id}>
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
                    <TableCell>
                      <RowActions
                        report={report}
                        usersById={usersById}
                        typesById={typesById}
                        receiptsById={receiptsById}
                        includeAccountingCode={showCodes}
                        onMarkPaid={() => markPaidMutation.mutate(report.id)}
                        markPaidPending={
                          markPaidMutation.isPending &&
                          markPaidMutation.variables === report.id
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Expense-type summary */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Expense-type summary
        </h2>
        <div className="overflow-hidden rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expense Type</TableHead>
                {showCodes && <TableHead>Accounting Code</TableHead>}
                <TableHead className="text-right">Line Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.map((s) => (
                <TableRow key={s.name}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  {showCodes && (
                    <TableCell className="tabular-nums">{s.code}</TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">{s.count}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(s.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}

function RowActions({
  report,
  usersById,
  typesById,
  receiptsById,
  includeAccountingCode,
  onMarkPaid,
  markPaidPending,
}: {
  report: ExpenseReport;
  usersById: Map<string, User>;
  typesById: Map<string, ExpenseType>;
  receiptsById: Map<string, Receipt>;
  includeAccountingCode: boolean;
  onMarkPaid: () => void;
  markPaidPending: boolean;
}) {
  const [excelBusy, setExcelBusy] = React.useState(false);

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
        includeAccountingCode,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExcelBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        title="Export PDF"
        aria-label="Export PDF"
        onClick={() =>
          window.open(`/reports/${report.id}/print?autoprint=1`, "_blank")
        }
      >
        <FileText className="size-4" />
      </Button>
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
    </div>
  );
}
