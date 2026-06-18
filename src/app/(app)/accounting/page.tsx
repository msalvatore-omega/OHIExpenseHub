import Link from "next/link";
import { BarChart3, Copy, FileText, History, Tag } from "lucide-react";

import { RoleGuard } from "@/components/role-guard";

const LINKS = [
  {
    href: "/accounting/analytics",
    icon: BarChart3,
    title: "Analytics",
    description: "Spend trends by type, department, and submitter.",
  },
  {
    href: "/accounting/reports",
    icon: FileText,
    title: "Expense Reports",
    description: "Review, pay, and export approved reports.",
  },
  {
    href: "/accounting/expense-types",
    icon: Tag,
    title: "Expense Type Summary",
    description: "Spend totaled by expense category with GL codes.",
  },
  {
    href: "/accounting/duplicates",
    icon: Copy,
    title: "Duplicate Detection",
    description: "Identify potential duplicate expense submissions.",
  },
  {
    href: "/accounting/change-log",
    icon: History,
    title: "Change Log",
    description: "Audit trail of all report status and field changes.",
  },
];

export default function AccountingPage() {
  return (
    <RoleGuard allow={["ACCOUNTING", "ADMIN"]}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header>
          <h1>Accounting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Payments, exports, analytics, and audit tools.
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
