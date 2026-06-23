import { ApprovalDetail } from "@/components/approvals/approval-detail";

// Next 16: dynamic route params are async.
export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ApprovalDetail reportId={id} />;
}
