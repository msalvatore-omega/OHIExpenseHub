import { AccountingReports } from "@/components/accounting/accounting-reports";
import { RoleGuard } from "@/components/role-guard";

export default function AccountingReportsPage() {
  return (
    <RoleGuard allow={["ACCOUNTING", "ADMIN"]}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8">
        <header>
          <h1>Accounting — Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review reports, summarize spend by type, and detect duplicates.
          </p>
        </header>
        <AccountingReports />
      </div>
    </RoleGuard>
  );
}
