import { AccountingChangeLog } from "@/components/accounting/accounting-reports";
import { RoleGuard } from "@/components/role-guard";

export default function AccountingChangeLogPage() {
  return (
    <RoleGuard allow={["ACCOUNTING", "ADMIN"]}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header>
          <h1>Accounting — Change Log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Audit trail of all report status and field changes.
          </p>
        </header>
        <AccountingChangeLog />
      </div>
    </RoleGuard>
  );
}
