import { AccountingExpenseTypeSummary } from "@/components/accounting/accounting-reports";
import { RoleGuard } from "@/components/role-guard";

export default function AccountingExpenseTypesPage() {
  return (
    <RoleGuard allow={["ACCOUNTING", "ADMIN"]}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header>
          <h1>Accounting — Expense Type Summary</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Spend totaled by expense type with optional GL code detail.
          </p>
        </header>
        <AccountingExpenseTypeSummary />
      </div>
    </RoleGuard>
  );
}
