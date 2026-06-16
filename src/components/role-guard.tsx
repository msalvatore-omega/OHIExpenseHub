"use client";

// Client-side role gate for restricted routes. The nav already hides these
// entries, but this guards direct URL access too. (Prototype-level — real
// authorization would be enforced server-side.)

import { useSession } from "@/lib/auth/mock-session";
import type { UserRole } from "@/lib/types";

export function RoleGuard({
  allow,
  children,
}: {
  allow: UserRole[];
  children: React.ReactNode;
}) {
  const { role } = useSession();

  if (!allow.includes(role)) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="flex h-48 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-center">
          <p className="text-sm font-medium">Access restricted</p>
          <p className="text-xs text-muted-foreground">
            This area is available to {allow.join(" / ")} roles. You are signed
            in as {role}.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
