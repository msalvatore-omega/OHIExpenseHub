import { AdminTabs } from "@/components/admin/admin-tabs";
import { RoleGuard } from "@/components/role-guard";

export default function AdminPage() {
  return (
    <RoleGuard allow={["ADMIN"]}>
      <AdminTabs />
    </RoleGuard>
  );
}
