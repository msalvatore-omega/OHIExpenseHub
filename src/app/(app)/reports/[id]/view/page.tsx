import { ReportViewer } from "@/components/reports/report-viewer";

// Next 16: dynamic route params are async.
export default async function ViewReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportViewer reportId={id} />;
}
