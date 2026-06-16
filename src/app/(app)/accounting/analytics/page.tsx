import { AnalyticsView } from "@/components/accounting/analytics-view";
import { RoleGuard } from "@/components/role-guard";

export default function AccountingAnalyticsPage() {
  return (
    <RoleGuard allow={["ACCOUNTING", "ADMIN"]}>
      <AnalyticsView />
    </RoleGuard>
  );
}
