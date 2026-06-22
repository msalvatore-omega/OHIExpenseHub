"use client";

// MOCK SESSION — stands in for NextAuth/Azure AD in the prototype.
// Holds the "current user" and role in React context, defaulting to an ADMIN.
// Switching role (via the dev role switcher) also swaps to a representative
// seed user for that role so the rest of the app sees a consistent identity.
// Replace with a real session provider later; keep useSession()'s shape.

import * as React from "react";

import { SESSION_COOKIE } from "@/lib/constants";
import { createSeedData } from "@/lib/data/seed";
import type { User, UserRole } from "@/lib/types";

const SEED_USERS = createSeedData().users;

function firstUserWithRole(role: UserRole): User {
  const match = SEED_USERS.find((u) => u.role === role);
  // There is always at least one user per role in the seed; fall back defensively.
  return match ?? SEED_USERS[0];
}

const DEFAULT_USER = firstUserWithRole("ADMIN");

interface SessionContextValue {
  user: User;
  role: UserRole;
  setRole: (role: UserRole) => void;
  setUser: (user: User) => void;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function MockSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = React.useState<User>(DEFAULT_USER);

  // Keep the session cookie in sync so Next.js middleware can identify visits.
  React.useEffect(() => {
    document.cookie = `${SESSION_COOKIE}=${user.id}; path=/; SameSite=Lax`;
  }, [user.id]);

  const setRole = React.useCallback((role: UserRole) => {
    setUser(firstUserWithRole(role));
  }, []);

  const value = React.useMemo<SessionContextValue>(
    () => ({ user, role: user.role, setRole, setUser }),
    [user, setRole]
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a MockSessionProvider");
  }
  return ctx;
}
