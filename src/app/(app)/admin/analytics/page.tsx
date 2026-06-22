import { RoleGuard } from "@/components/role-guard";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";

export default function AdminAnalyticsPage() {
  return (
    <RoleGuard allow={["ADMIN"]}>
      <AnalyticsDashboard />
    </RoleGuard>
  );
}
