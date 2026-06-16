// Navigation model for the authenticated app shell.
// Role-based visibility is driven by the (mock) session role.

import type { LucideIcon } from "lucide-react";
import {
  Calculator,
  ClipboardCheck,
  FilePlus2,
  Home,
  Images,
  Inbox,
  ReceiptText,
  Shield,
} from "lucide-react";

import type { UserRole } from "@/lib/types";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** When set, the item is only visible to these roles. Undefined = everyone. */
  roles?: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "New Expense", href: "/reports/new", icon: FilePlus2 },
  { label: "My Expenses", href: "/my-expenses", icon: ReceiptText },
  { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
  { label: "Receipt Gallery", href: "/gallery", icon: Images },
  {
    label: "Outbox",
    href: "/outbox",
    icon: Inbox,
    roles: ["APPROVER", "ADMIN", "ACCOUNTING"],
  },
  {
    label: "Accounting",
    href: "/accounting",
    icon: Calculator,
    roles: ["ACCOUNTING", "ADMIN"],
  },
  { label: "Admin", href: "/admin", icon: Shield, roles: ["ADMIN"] },
];

/** Items the given role is allowed to see, in nav order. */
export function visibleNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}
