import { RoleGuard } from "@/components/role-guard";
import { AdminExpenseReports } from "@/components/admin/admin-expense-reports";

export default function AdminExpenseReportsPage() {
  return (
    <RoleGuard allow={["ADMIN"]}>
      <AdminExpenseReports />
    </RoleGuard>
  );
}
