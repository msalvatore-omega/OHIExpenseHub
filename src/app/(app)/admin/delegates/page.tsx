import { DelegatesTab } from "@/components/admin/admin-tabs";
import { RoleGuard } from "@/components/role-guard";

export default function AdminDelegatesPage() {
  return (
    <RoleGuard allow={["ADMIN"]}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header>
          <h1>Admin — Delegates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Assign users who can submit expenses on behalf of others.
          </p>
        </header>
        <DelegatesTab />
      </div>
    </RoleGuard>
  );
}
