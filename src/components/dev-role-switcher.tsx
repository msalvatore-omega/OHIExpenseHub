"use client";

// PROTOTYPE-ONLY scaffolding. A floating control (bottom-right) to switch the
// active role and reset the mock data. Keep all of this isolated in this one
// file so it's trivial to delete before any real deployment.

import * as React from "react";
import { ChevronsUpDown, FlaskConical, RotateCcw } from "lucide-react";

import { useSession } from "@/lib/auth/mock-session";
import { resetDemoData } from "@/lib/data/store";
import type { UserRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLES: UserRole[] = ["SUBMITTER", "APPROVER", "ADMIN", "ACCOUNTING"];

export function DevRoleSwitcher() {
  const { user, role, setRole } = useSession();

  function handleReset() {
    resetDemoData();
    // Reload so every React Query cache re-reads the freshly seeded store.
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <div className="fixed right-4 bottom-4 z-[100]">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-background/95 p-3 shadow-lg ring-1 ring-foreground/5 backdrop-blur">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="gap-1 font-mono text-[10px] tracking-wider"
          >
            <FlaskConical className="size-3" />
            PROTOTYPE
          </Badge>
          <span className="max-w-[140px] truncate text-xs text-muted-foreground">
            {user.name}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="w-[150px] justify-between"
                />
              }
            >
              {role}
              <ChevronsUpDown className="size-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuLabel>Switch active role</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={role}
                onValueChange={(value) => setRole(value as UserRole)}
              >
                {ROLES.map((r) => (
                  <DropdownMenuRadioItem key={r} value={r}>
                    {r}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            title="Reset demo data"
            aria-label="Reset demo data"
          >
            <RotateCcw className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
