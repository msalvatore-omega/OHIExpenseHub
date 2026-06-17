"use client";

// Sidebar light/dark switch wired to next-themes. The choice is persisted by
// next-themes (localStorage) and reapplied on reload. Renders a stable
// placeholder until mounted to avoid a hydration mismatch.

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { cn } from "@/lib/utils";

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  // One-time mount flag so the icon matches the resolved theme post-hydration
  // (next-themes can't know the theme during SSR). Not cascading state sync.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  React.useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Light mode" : "Dark mode";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center rounded-md py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground",
        collapsed ? "w-full justify-center px-0" : "w-full justify-start gap-3 px-3"
      )}
    >
      {/* Keep the icon box reserved pre-mount so layout doesn't shift. */}
      {!mounted ? (
        <Sun className="size-4 shrink-0 opacity-0" />
      ) : isDark ? (
        <Sun className="size-4 shrink-0" />
      ) : (
        <Moon className="size-4 shrink-0" />
      )}
      {!collapsed && <span>{mounted ? label : "Theme"}</span>}
    </button>
  );
}
