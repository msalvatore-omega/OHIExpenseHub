"use client";

// Export PDF (opens the print view in a modal) + Export Excel (SheetJS).

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getExpenseTypes,
  getReceipts,
  getReport,
  getReportChangeLogs,
  getUsers,
} from "@/lib/data";
import type { ReportChangeLog } from "@/lib/types";
import { exportReportToExcel } from "@/lib/export/excel";
import { Button } from "@/components/ui/button";
import { PdfViewerDialog } from "@/components/reports/pdf-viewer-dialog";

export function ReportExportButtons({ reportId }: { reportId: string }) {
  const [generating, setGenerating] = React.useState(false);
  const [pdfOpen, setPdfOpen] = React.useState(false);

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
  const changeLogsQuery = useQuery({
    queryKey: ["report-change-log", reportId],
    queryFn: () => getReportChangeLogs(reportId),
  });

  const dataReady =
    reportQuery.data &&
    usersQuery.data &&
    typesQuery.data &&
    receiptsQuery.data;

  const handlePdf = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      window.open(`/reports/${reportId}/print`, "_blank");
    } else {
      setPdfOpen(true);
    }
  };

  const handleExcel = async () => {
    if (!dataReady) return;
    setGenerating(true);
    try {
      // Yield a frame so the spinner paints before the (sync) build.
      await new Promise((r) => setTimeout(r, 30));
      const report = reportQuery.data!;
      const usersById = new Map(usersQuery.data!.map((u) => [u.id, u]));
      const logs = changeLogsQuery.data ?? [];
      const reclassLogs = logs.filter(
        (c) => c.changeType === "FIELD" && c.field === "expenseTypeId"
      );
      const changeLogsByLineItemId = new Map<string, ReportChangeLog>(
        report.lineItems
          .filter((li) => li.reclassifiedAt && li.reclassifiedById)
          .map((li) => {
            const match =
              reclassLogs.find(
                (c) => c.changedAt === li.reclassifiedAt && c.changedById === li.reclassifiedById
              ) ?? reclassLogs.find((c) => c.changedById === li.reclassifiedById);
            return match ? ([li.id, match] as [string, ReportChangeLog]) : null;
          })
          .filter((e): e is [string, ReportChangeLog] => e !== null)
      );
      exportReportToExcel({
        report,
        usersById,
        typesById: new Map(typesQuery.data!.map((t) => [t.id, t])),
        receiptsById: new Map(receiptsQuery.data!.map((r) => [r.id, r])),
        changeLogsByLineItemId,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <PdfViewerDialog
        reportId={reportId}
        open={pdfOpen}
        onOpenChange={setPdfOpen}
      />
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handlePdf}>
        <FileText className="size-4" />
        Export PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExcel}
        disabled={!dataReady || generating}
      >
        {generating ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="size-4" />
        )}
        Export Excel
      </Button>
    </div>
    </>
  );
}
