import Link from "next/link";
import { Network, Settings, Tag, UserCheck, Users } from "lucide-react";

import { RoleGuard } from "@/components/role-guard";

const LINKS = [
  {
    href: "/admin/users",
    icon: Users,
    title: "Users",
    description: "Manage accounts, roles, approval chains, and fast-track thresholds.",
  },
  {
    href: "/admin/delegates",
    icon: UserCheck,
    title: "Delegates",
    description: "Assign users who can submit on behalf of others.",
  },
  {
    href: "/admin/expense-types",
    icon: Tag,
    title: "Expense Types",
    description: "Configure categories, GL codes, and mileage types.",
  },
  {
    href: "/admin/approval-groups",
    icon: Network,
    title: "Approval Groups",
    description: "Manage Accounting and Executive group membership.",
  },
  {
    href: "/admin/system",
    icon: Settings,
    title: "System",
    description: "App version and announcement banner settings.",
  },
];

export default function AdminPage() {
  return (
    <RoleGuard allow={["ADMIN"]}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header>
          <h1>Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Users, delegates, expense types, approval groups, and system settings.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <l.icon className="size-5 text-primary" />
              <span className="font-semibold">{l.title}</span>
              <span className="text-sm text-muted-foreground">
                {l.description}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </RoleGuard>
  );
}
