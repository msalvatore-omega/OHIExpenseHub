"use client";

// Mock login. Lists all active users so you can sign in as any persona.
// No real auth — selecting a user sets the mock session and routes into the app.

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { getUsers } from "@/lib/data";
import type { User, UserRole } from "@/lib/types";
import { useSession } from "@/lib/auth/mock-session";
import { clearAnnouncementDismissal } from "@/components/announcement-banner";
import { BrandLogo } from "@/components/brand-logo";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const ROLE_ORDER: UserRole[] = ["ADMIN", "ACCOUNTING", "EMPLOYEE"];
const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Admin",
  ACCOUNTING: "Accounting",
  EMPLOYEE: "Employee",
};
const ROLE_BADGE: Record<UserRole, string> = {
  ADMIN: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  ACCOUNTING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  EMPLOYEE: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function UserRow({ user, onSelect }: { user: User; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
        {initials(user.name)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.department}</p>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
          ROLE_BADGE[user.role]
        )}
      >
        {ROLE_LABEL[user.role]}
      </span>
    </button>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useSession();
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const activeUsers = (usersQuery.data ?? []).filter((u) => u.isActive);

  const grouped = ROLE_ORDER.map((role) => ({
    role,
    users: activeUsers.filter((u) => u.role === role),
  })).filter((g) => g.users.length > 0);

  function handleSelect(user: User) {
    clearAnnouncementDismissal();
    setUser(user);
    router.push("/dashboard");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center pb-4">
          <BrandLogo className="mb-3 size-14" />
          <CardTitle className="text-xl">{APP_NAME}</CardTitle>
          <CardDescription>Select a prototype user to sign in as</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {grouped.map(({ role, users }) => (
            <div key={role} className="flex flex-col gap-1.5">
              <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {ROLE_LABEL[role]}
              </p>
              {users.map((u) => (
                <UserRow key={u.id} user={u} onSelect={() => handleSelect(u)} />
              ))}
            </div>
          ))}
          <p className="text-center text-[11px] text-muted-foreground pt-1">
            Prototype — authentication is simulated.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
