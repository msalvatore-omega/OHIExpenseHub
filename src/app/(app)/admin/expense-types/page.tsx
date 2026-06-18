import { ExpenseTypesTab } from "@/components/admin/admin-tabs";
import { RoleGuard } from "@/components/role-guard";

export default function AdminExpenseTypesPage() {
  return (
    <RoleGuard allow={["ADMIN"]}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header>
          <h1>Admin — Expense Types</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure expense categories, GL codes, and mileage types.
          </p>
        </header>
        <ExpenseTypesTab />
      </div>
    </RoleGuard>
  );
}
