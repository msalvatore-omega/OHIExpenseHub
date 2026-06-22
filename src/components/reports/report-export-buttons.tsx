"use client";

// Export PDF (opens the print view) + Export Excel (SheetJS).

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getExpenseTypes,
  getReceipts,
  getReport,
  getUsers,
} from "@/lib/data";
import { exportReportToExcel } from "@/lib/export/excel";
import { canSeeGlDetails } from "@/lib/expense-type";
import { useSession } from "@/lib/auth/mock-session";
import { Button } from "@/components/ui/button";

export function ReportExportButtons({ reportId }: { reportId: string }) {
  const { role } = useSession();
  const [generating, setGenerating] = React.useState(false);

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

  const dataReady =
    reportQuery.data &&
    usersQuery.data &&
    typesQuery.data &&
    receiptsQuery.data;

  const handlePdf = () => {
    window.open(`/reports/${reportId}/print`, "_blank");
  };

  const handleExcel = async () => {
    if (!dataReady) return;
    setGenerating(true);
    try {
      // Yield a frame so the spinner paints before the (sync) build.
      await new Promise((r) => setTimeout(r, 30));
      exportReportToExcel({
        report: reportQuery.data!,
        usersById: new Map(usersQuery.data!.map((u) => [u.id, u])),
        typesById: new Map(typesQuery.data!.map((t) => [t.id, t])),
        receiptsById: new Map(receiptsQuery.data!.map((r) => [r.id, r])),
        includeGlColumns: canSeeGlDetails(role),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
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
  );
}
