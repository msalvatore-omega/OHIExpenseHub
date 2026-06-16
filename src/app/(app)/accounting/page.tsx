import Link from "next/link";
import { BarChart3, FileText } from "lucide-react";

import { RoleGuard } from "@/components/role-guard";

const LINKS = [
  {
    href: "/accounting/reports",
    icon: FileText,
    title: "Reports",
    description: "Process payments, export, and review duplicates.",
  },
  {
    href: "/accounting/analytics",
    icon: BarChart3,
    title: "Analytics",
    description: "Spend trends by type, department, and submitter.",
  },
];

export default function AccountingPage() {
  return (
    <RoleGuard allow={["ACCOUNTING", "ADMIN"]}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        <header>
          <h1>Accounting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Payments, exports, and spend analytics.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
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
