import { ReportEditor } from "@/components/reports/report-editor";

// Next 16: dynamic route params are async.
export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ReportEditor reportId={id} />;
}
