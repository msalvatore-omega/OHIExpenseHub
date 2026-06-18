// GL visibility for expense types. GL code/name are only ever shown in the
// ACCOUNTING/ADMIN areas (reports + summary tabs, Excel export, Admin tab) —
// never in the report editor or report detail view. This gate guards the
// export columns; the accounting/admin tables are already behind a RoleGuard.

import type { UserRole } from "@/lib/types";

export function canSeeGlDetails(role: UserRole): boolean {
  return role === "ADMIN" || role === "ACCOUNTING";
}
