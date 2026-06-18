import { DuplicateDetection } from "@/components/accounting/duplicate-detection";
import { RoleGuard } from "@/components/role-guard";

export default function AccountingDuplicatesPage() {
  return (
    <RoleGuard allow={["ACCOUNTING", "ADMIN"]}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header>
          <h1>Accounting — Duplicate Detection</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Identify potential duplicate expense submissions.
          </p>
        </header>
        <DuplicateDetection />
      </div>
    </RoleGuard>
  );
}
