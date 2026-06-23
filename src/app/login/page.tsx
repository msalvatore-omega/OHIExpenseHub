"use client";

// Mock login. Simulates Azure AD sign-in by accepting an email address and
// running the same lookup-or-reject logic that the production NextAuth callback
// will execute.  Only pre-provisioned, active users may sign in.
// A dev shortcut list lets testers pick without typing.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { getUsers, simulateAzureAdSignIn } from "@/lib/data";
import type { User, UserRole } from "@/lib/types";
import { useSession } from "@/lib/auth/mock-session";
import { clearAnnouncementDismissal } from "@/components/announcement-banner";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useSession();
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const activeUsers = (usersQuery.data ?? []).filter((u) => u.isActive);
  const grouped = ROLE_ORDER.map((role) => ({
    role,
    users: activeUsers.filter((u) => u.role === role),
  })).filter((g) => g.users.length > 0);

  async function handleSignIn(emailValue: string) {
    const trimmed = emailValue.trim();
    if (!trimmed) { setError("Enter your email to continue."); return; }
    setPending(true);
    setError("");
    try {
      const result = await simulateAzureAdSignIn(trimmed);
      if (result.status === "DENIED_INACTIVE") {
        router.push("/auth/error?reason=deactivated");
        return;
      }
      if (result.status === "DENIED_UNPROVISIONED") {
        router.push("/auth/error?reason=unprovisioned");
        return;
      }
      clearAnnouncementDismissal();
      setUser(result.user);
      router.push("/dashboard");
    } finally {
      setPending(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void handleSignIn(email);
  }

  function handleDevPick(user: User) {
    void handleSignIn(user.email);
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <Card>
          <CardHeader className="items-center text-center pb-4">
            <BrandLogo className="mb-3 size-14" />
            <CardTitle className="text-xl">{APP_NAME}</CardTitle>
            <CardDescription>Sign in with your OHI email address</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                type="email"
                placeholder="you@omegahealthcare.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                disabled={pending}
                autoFocus
                autoComplete="email"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" disabled={pending || !email.trim()}>
                {pending && <Loader2 className="size-4 animate-spin" />}
                Sign in with Azure AD
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Dev shortcut — prototype only */}
        <Card className="border-dashed">
          <CardHeader className="pb-2 pt-4">
            <CardDescription className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Prototype — sign in as
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pb-4">
            {grouped.map(({ role, users }) => (
              <div key={role} className="flex flex-col gap-1">
                <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {ROLE_LABEL[role]}
                </p>
                {users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={pending}
                    onClick={() => handleDevPick(u)}
                    className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {initials(u.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{u.email}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        ROLE_BADGE[u.role]
                      )}
                    >
                      {ROLE_LABEL[u.role]}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
