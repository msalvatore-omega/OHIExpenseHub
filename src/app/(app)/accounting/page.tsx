import { PagePlaceholder } from "@/components/page-placeholder";
import { RoleGuard } from "@/components/role-guard";

export default function AccountingPage() {
  return (
    <RoleGuard allow={["ACCOUNTING", "ADMIN"]}>
      <PagePlaceholder
        title="Accounting"
        description="Approved reports ready for payment and export."
      />
    </RoleGuard>
  );
}
