import { ApprovalDetail } from "@/components/approvals/approval-detail";
import { RoleGuard } from "@/components/role-guard";

// Next 16: dynamic route params are async.
export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RoleGuard allow={["APPROVER", "ADMIN"]}>
      <ApprovalDetail reportId={id} />
    </RoleGuard>
  );
}
