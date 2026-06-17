"use client";

// Responsive application shell for authenticated routes.
// - Desktop (md+): collapsible left sidebar (64px collapsed / 220px expanded).
// - Mobile: top app bar + bottom tab bar (overflow items behind "More").
// Role-based visibility and the footer identity are driven by useSession().

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import { useSession } from "@/lib/auth/mock-session";
import { visibleNavItems, type NavItem } from "@/lib/nav";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SIDEBAR_STORAGE_KEY = "ohi-sidebar-collapsed";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function useActive() {
  const pathname = usePathname();
  return React.useCallback(
    (href: string) => pathname === href || pathname.startsWith(`${href}/`),
    [pathname]
  );
}

function BrandMark() {
  return <BrandLogo className="size-8 shrink-0" />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { role } = useSession();
  const items = visibleNavItems(role);

  return (
    <div className="flex min-h-svh w-full">
      <DesktopSidebar items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopBar />
        <main className="flex-1 pb-20 md:pb-0">{children}</main>
        <MobileBottomBar items={items} />
      </div>
    </div>
  );
}

// ---------------- Desktop sidebar ----------------

function DesktopSidebar({ items }: { items: NavItem[] }) {
  const { user, role } = useSession();
  const router = useRouter();
  const isActive = useActive();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    try {
      // Hydrate the collapsed pref after mount (localStorage is client-only).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(
        window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
      );
    } catch {
      // ignore
    }
  }, []);

  const toggle = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex print:!hidden",
        collapsed ? "w-16" : "w-[220px]"
      )}
    >
      {/* Header / wordmark */}
      <div
        className={cn(
          "flex h-14 items-center gap-2 border-b border-sidebar-border px-3",
          collapsed && "justify-center px-0"
        )}
      >
        {!collapsed && (
          <Link
            href="/dashboard"
            aria-label={`${APP_NAME} — go to Home`}
            className="-mx-1 flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-sidebar-accent/60"
          >
            <BrandMark />
            <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
              {APP_NAME}
            </span>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={cn("size-8", !collapsed && "ml-auto")}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {items.map((item) =>
          item.children?.length ? (
            <SidebarGroup
              key={item.href}
              item={item}
              collapsed={collapsed}
              isActive={isActive}
            />
          ) : (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                isActive(item.href)
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <div
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? `${user.name} (${role})` : undefined}
        >
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <Badge variant="secondary" className="mt-0.5 text-[10px]">
                {role}
              </Badge>
            </div>
          )}
        </div>
        <ThemeToggle collapsed={collapsed} />
        <Button
          variant="ghost"
          onClick={() => router.push("/login")}
          className={cn(
            "mt-1 w-full text-muted-foreground hover:text-foreground",
            collapsed ? "justify-center px-0" : "justify-start gap-3 px-3"
          )}
          title={collapsed ? "Sign out" : undefined}
          aria-label="Sign out"
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </Button>
      </div>
    </aside>
  );
}

// ---------------- Sidebar expandable group ----------------

function SidebarGroup({
  item,
  collapsed,
  isActive,
}: {
  item: NavItem;
  collapsed: boolean;
  isActive: (href: string) => boolean;
}) {
  const children = item.children ?? [];
  const childActive = children.some((c) => isActive(c.href));
  const [open, setOpen] = React.useState(childActive);

  // Auto-expand the group whenever one of its child routes becomes active.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (childActive) setOpen(true);
  }, [childActive]);

  // Collapsed (icon-only) sidebar: reveal children in a hover/focus flyout.
  if (collapsed) {
    return (
      <div className="group/sb relative">
        <div
          title={item.label}
          className={cn(
            "flex items-center justify-center rounded-md py-2 text-sm font-medium transition-colors",
            childActive
              ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 group-hover/sb:bg-sidebar-accent/60 group-hover/sb:text-sidebar-foreground"
          )}
        >
          <item.icon className="size-4 shrink-0" />
        </div>
        <div className="invisible absolute top-0 left-full z-50 ml-2 w-48 rounded-lg border border-sidebar-border bg-sidebar p-1 opacity-0 shadow-md transition-opacity group-hover/sb:visible group-hover/sb:opacity-100 group-focus-within/sb:visible group-focus-within/sb:opacity-100">
          <p className="px-2 py-1.5 text-xs font-medium text-sidebar-foreground/60">
            {item.label}
          </p>
          {children.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                isActive(c.href)
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <c.icon className="size-4 shrink-0" />
              <span className="truncate">{c.label}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Expanded sidebar: accordion with the children stacked below the header.
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          childActive
            ? "text-sidebar-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        )}
      >
        <item.icon className="size-4 shrink-0" />
        <span className="truncate">{item.label}</span>
        <ChevronDown
          className={cn(
            "ml-auto size-4 shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="mt-1 flex flex-col gap-1 pl-4">
          {children.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive(c.href)
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              )}
            >
              <c.icon className="size-4 shrink-0" />
              <span className="truncate">{c.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Mobile top bar ----------------

function MobileTopBar() {
  const { user, role } = useSession();
  const router = useRouter();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden print:hidden">
      <div className="flex items-center gap-2">
        <BrandMark />
        <span className="text-sm font-semibold">{APP_NAME}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="rounded-full" />
          }
          aria-label="Account menu"
        >
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{user.name}</span>
              <span className="text-xs text-muted-foreground">{role}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/login")}>
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

// ---------------- Mobile bottom tab bar ----------------

function MobileBottomBar({ items }: { items: NavItem[] }) {
  const isActive = useActive();

  // Mobile: the bottom bar carries only Home. Every other destination is
  // reached from the Home dashboard's action buttons.
  const home = items.find((item) => item.href === "/dashboard");
  if (!home) return null;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-background/95 backdrop-blur md:hidden print:hidden">
      <BottomTab item={home} active={isActive(home.href)} />
    </nav>
  );
}

function BottomTab({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <item.icon className={cn("size-5", active && "text-foreground")} />
      <span className="max-w-full truncate px-1">{item.label}</span>
    </Link>
  );
}

