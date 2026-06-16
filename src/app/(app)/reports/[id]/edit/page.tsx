import { PagePlaceholder } from "@/components/page-placeholder";

// Next 16: dynamic route params are async.
export default async function EditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PagePlaceholder
      title="Edit Expense Report"
      description={`Report ${id} — line items, receipts, and submission are coming soon.`}
    />
  );
}
