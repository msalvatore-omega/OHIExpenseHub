"use client";

import * as React from "react";

import { useSession } from "@/lib/auth/mock-session";
import { reclassifyLineItemExpenseType } from "@/lib/data";
import { ReportDetailView } from "@/components/reports/report-detail-view";

export function AccountingReportDetail({
  reportId,
  actions,
}: {
  reportId: string;
  actions?: React.ReactNode;
}) {
  const { user } = useSession();

  const handleReclassify = async (
    lineItemId: string,
    newTypeId: string,
    reason: string
  ) => {
    await reclassifyLineItemExpenseType(reportId, lineItemId, newTypeId, reason, user.id);
  };

  return (
    <ReportDetailView
      reportId={reportId}
      actions={actions}
      onReclassify={handleReclassify}
    />
  );
}
