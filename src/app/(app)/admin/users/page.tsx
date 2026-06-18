import { UsersTab } from "@/components/admin/admin-tabs";
import { RoleGuard } from "@/components/role-guard";

export default function AdminUsersPage() {
  return (
    <RoleGuard allow={["ADMIN"]}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header>
          <h1>Admin — Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage user accounts, roles, approval chains, and fast-track thresholds.
          </p>
        </header>
        <UsersTab />
      </div>
    </RoleGuard>
  );
}
