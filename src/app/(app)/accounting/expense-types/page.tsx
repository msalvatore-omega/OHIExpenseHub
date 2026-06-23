import { ExpenseTypeManagement } from "@/components/accounting/expense-type-management";
import { RoleGuard } from "@/components/role-guard";

export default function AccountingExpenseTypesPage() {
  return (
    <RoleGuard allow={["ACCOUNTING", "ADMIN"]}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header>
          <h1>Expense Type Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage the expense categories available to employees.
          </p>
        </header>
        <ExpenseTypeManagement />
      </div>
    </RoleGuard>
  );
}
