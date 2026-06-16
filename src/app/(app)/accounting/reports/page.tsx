import { AccountingReports } from "@/components/accounting/accounting-reports";
import { DuplicateDetection } from "@/components/accounting/duplicate-detection";
import { RoleGuard } from "@/components/role-guard";

export default function AccountingReportsPage() {
  return (
    <RoleGuard allow={["ACCOUNTING", "ADMIN"]}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8">
        <header>
          <h1>Accounting — Reports</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Process payments and review potential duplicates.
          </p>
        </header>
        <AccountingReports />
        <DuplicateDetection />
      </div>
    </RoleGuard>
  );
}
