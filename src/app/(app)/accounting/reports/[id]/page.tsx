import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ReportDetailView } from "@/components/reports/report-detail-view";
import { ReportExportButtons } from "@/components/reports/report-export-buttons";
import { ReportStatusSelect } from "@/components/reports/report-status-select";
import { RoleGuard } from "@/components/role-guard";

// Next 16: dynamic route params are async.
export default async function AccountingReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RoleGuard allow={["ACCOUNTING", "ADMIN"]}>
      <div className="mx-auto w-full max-w-3xl px-6 pt-6">
        <Link
          href="/accounting/reports"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Reports
        </Link>
      </div>
      <ReportDetailView
        reportId={id}
        actions={
          <>
            <ReportStatusSelect reportId={id} />
            <ReportExportButtons reportId={id} />
          </>
        }
      />
    </RoleGuard>
  );
}
