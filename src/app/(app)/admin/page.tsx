import { PagePlaceholder } from "@/components/page-placeholder";
import { RoleGuard } from "@/components/role-guard";

export default function AdminPage() {
  return (
    <RoleGuard allow={["ADMIN"]}>
      <PagePlaceholder
        title="Admin"
        description="Users, delegates, expense types, and system settings."
      />
    </RoleGuard>
  );
}
