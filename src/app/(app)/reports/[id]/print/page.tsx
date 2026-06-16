import { Suspense } from "react";

import { ReportPrintView } from "@/components/reports/report-print-view";

// Next 16: dynamic route params are async; useSearchParams needs a Suspense boundary.
export default async function PrintReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <ReportPrintView reportId={id} />
    </Suspense>
  );
}
