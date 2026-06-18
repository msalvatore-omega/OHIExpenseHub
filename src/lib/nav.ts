// Navigation model for the authenticated app shell.
// Role-based visibility is driven by the (mock) session role.

import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Calculator,
  ClipboardCheck,
  Copy,
  FilePlus2,
  FileText,
  History,
  Home,
  Images,
  Network,
  ReceiptText,
  Settings,
  Shield,
  Tag,
  UserCheck,
  Users,
} from "lucide-react";

import type { UserRole } from "@/lib/types";

/** A leaf link nested under an expandable nav group. */
export interface NavChild {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** When set, the item is only visible to these roles. Undefined = everyone. */
  roles?: UserRole[];
  /** When present, the item is an expandable group rather than a direct link. */
  children?: NavChild[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "New Expense", href: "/reports/new", icon: FilePlus2 },
  { label: "My Expenses", href: "/my-expenses", icon: ReceiptText },
  { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
  { label: "Receipt Gallery", href: "/gallery", icon: Images },
  {
    label: "Accounting",
    href: "/accounting",
    icon: Calculator,
    roles: ["ACCOUNTING", "ADMIN"],
    children: [
      { label: "Analytics", href: "/accounting/analytics", icon: BarChart3 },
      { label: "Expense Reports", href: "/accounting/reports", icon: FileText },
      { label: "Expense Types", href: "/accounting/expense-types", icon: Tag },
      { label: "Duplicates", href: "/accounting/duplicates", icon: Copy },
      { label: "Change Log", href: "/accounting/change-log", icon: History },
    ],
  },
  {
    label: "Admin",
    href: "/admin",
    icon: Shield,
    roles: ["ADMIN"],
    children: [
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Delegates", href: "/admin/delegates", icon: UserCheck },
      { label: "Expense Types", href: "/admin/expense-types", icon: Tag },
      { label: "Approval Groups", href: "/admin/approval-groups", icon: Network },
      { label: "System", href: "/admin/system", icon: Settings },
    ],
  },
];

/** Items the given role is allowed to see, in nav order. */
export function visibleNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
