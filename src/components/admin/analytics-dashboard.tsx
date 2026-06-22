"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { getActivityAnalytics, getDepartments, getUsers } from "@/lib/data";
import type {
  ActivityFilter,
  ActivityAnalyticsResult,
  UserRole,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---- constants ----

const PALETTE = [
  "#0B2545", "#C8A02E", "#1E7A5A", "#C98A1E", "#B23A48",
  "#13315C", "#5B8FC9", "#7C9A92", "#9B6A6C", "#3E6B89",
];

const ROLES: UserRole[] = ["SUBMITTER", "APPROVER", "ACCOUNTING", "ADMIN"];

type DatePreset = "today" | "7d" | "30d" | "90d" | "year" | "custom";

function presetDates(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = iso(now);
  if (preset === "today") return { from: today, to: today };
  if (preset === "7d") {
    const d = new Date(now); d.setDate(d.getDate() - 6);
    return { from: iso(d), to: today };
  }
  if (preset === "30d") {
    const d = new Date(now); d.setDate(d.getDate() - 29);
    return { from: iso(d), to: today };
  }
  if (preset === "90d") {
    const d = new Date(now); d.setDate(d.getDate() - 89);
    return { from: iso(d), to: today };
  }
  if (preset === "year") {
    return { from: `${now.getFullYear()}-01-01`, to: today };
  }
  return { from: "", to: "" };
}

// ---- small shared pieces ----

function Chip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 pl-2.5 pr-1.5 py-0.5 text-xs font-medium text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="rounded-full p-0.5 hover:bg-primary/20"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function PresetBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm",
        className
      )}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

// ---- CSV export ----

function exportCsv(data: ActivityAnalyticsResult) {
  const headers = [
    "Time",
    "User",
    "Role",
    "Department",
    "Path",
    "Browser",
    "OS",
    "Device",
    "IP",
  ];
  const escape = (v?: string | null) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const rows = data.rows.map((r) =>
    [
      escape(r.createdAt),
      escape(r.userName),
      escape(r.userRole),
      escape(r.userDept),
      escape(r.path),
      escape(r.browser),
      escape(r.os),
      escape(r.deviceType),
      escape(r.ipAddress),
    ].join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ohi-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- main component ----

export function AnalyticsDashboard() {
  // Date range
  const [preset, setPreset] = React.useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");

  // Multi-select filters
  const [userIds, setUserIds] = React.useState<string[]>([]);
  const [roles, setRoles] = React.useState<UserRole[]>([]);
  const [departments, setDepartments] = React.useState<string[]>([]);
  const [pathFilter, setPathFilter] = React.useState("");

  // Detail table
  const [page, setPage] = React.useState(1);

  // Resolve from/to from preset
  const { from, to } = React.useMemo(
    () => (preset === "custom" ? { from: customFrom, to: customTo } : presetDates(preset)),
    [preset, customFrom, customTo]
  );

  const filter: ActivityFilter = {
    from: from || undefined,
    to: to || undefined,
    userIds: userIds.length ? userIds : undefined,
    roles: roles.length ? roles : undefined,
    departments: departments.length ? departments : undefined,
    path: pathFilter || undefined,
    page,
    pageSize: 100,
  };

  const analyticsQ = useQuery({
    queryKey: ["activity-analytics", filter],
    queryFn: () => getActivityAnalytics(filter),
  });
  const usersQ = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const deptsQ = useQuery({ queryKey: ["departments"], queryFn: getDepartments });

  const data = analyticsQ.data;
  const loading = analyticsQ.isLoading;

  // Reset page on filter change
  React.useEffect(() => setPage(1), [from, to, userIds, roles, departments, pathFilter]);

  // Helpers to toggle multi-select lists
  function toggleUserId(id: string) {
    setUserIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }
  function toggleRole(r: UserRole) {
    setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }
  function toggleDept(d: string) {
    setDepartments((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  const userMap = React.useMemo(
    () => new Map((usersQ.data ?? []).map((u) => [u.id, u.name])),
    [usersQ.data]
  );

  // Active filter chips for the removable strip
  const chips: { label: string; onRemove: () => void }[] = [
    ...userIds.map((id) => ({
      label: `User: ${userMap.get(id) ?? id}`,
      onRemove: () => setUserIds((p) => p.filter((x) => x !== id)),
    })),
    ...roles.map((r) => ({
      label: `Role: ${r}`,
      onRemove: () => setRoles((p) => p.filter((x) => x !== r)),
    })),
    ...departments.map((d) => ({
      label: `Dept: ${d}`,
      onRemove: () => setDepartments((p) => p.filter((x) => x !== d)),
    })),
    ...(pathFilter
      ? [{ label: `Path: ${pathFilter}`, onRemove: () => setPathFilter("") }]
      : []),
  ];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 100)) : 1;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1>User Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Page-visit activity across all authenticated users.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!data || data.rows.length === 0}
          onClick={() => data && exportCsv(data)}
        >
          <Download className="mr-2 size-4" />
          Export CSV
        </Button>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        {/* Date presets */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">Date range</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["today", "7d", "30d", "90d", "year", "custom"] as DatePreset[]).map((p) => (
              <PresetBtn key={p} active={preset === p} onClick={() => setPreset(p)}>
                {p === "today" ? "Today" : p === "7d" ? "Last 7 days" : p === "30d" ? "Last 30 days" : p === "90d" ? "Last 90 days" : p === "year" ? "This year" : "Custom"}
              </PresetBtn>
            ))}
            {preset === "custom" && (
              <div className="flex items-center gap-2 pl-2">
                <Input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-7 w-36 text-xs"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-7 w-36 text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* User filter */}
        {(usersQ.data?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">User</span>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
              {(usersQ.data ?? []).filter((u) => u.isActive).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleUserId(u.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    userIds.includes(u.id)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {u.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Role + Department filters */}
        <div className="flex flex-wrap gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Role</span>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRole(r)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    roles.includes(r)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Department</span>
            <div className="flex flex-wrap gap-1.5">
              {(deptsQ.data ?? []).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDept(d)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                    departments.includes(d)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active filter chips */}
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Active:</span>
            {chips.map((c) => (
              <Chip key={c.label} label={c.label} onRemove={c.onRemove} />
            ))}
            <button
              type="button"
              onClick={() => {
                setUserIds([]);
                setRoles([]);
                setDepartments([]);
                setPathFilter("");
              }}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : (
          <>
            <KpiCard label="Total Visits" value={(data?.kpis.totalVisits ?? 0).toLocaleString()} />
            <KpiCard label="Unique Users" value={(data?.kpis.uniqueUsers ?? 0).toLocaleString()} />
            <KpiCard label="Avg Visits / User" value={(data?.kpis.avgVisitsPerUser ?? 0).toLocaleString()} />
            <KpiCard label="Most Visited Page" value={data?.kpis.mostVisitedPage ?? "—"} />
          </>
        )}
      </section>

      {/* Empty state */}
      {!loading && data && data.kpis.totalVisits === 0 && (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          No activity recorded for the selected filters.
        </div>
      )}

      {/* Charts */}
      {!loading && data && data.kpis.totalVisits > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Visits over time */}
          <div className="lg:col-span-2">
            <ChartCard title="Visits Over Time (Daily)">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.visitsByDay} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" name="Visits" stroke={PALETTE[0]} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Top 10 pages */}
          <ChartCard title="Top 10 Pages">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topPages} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={140} fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Visits"
                  fill={PALETTE[0]}
                  radius={[0, 4, 4, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(d) => { if (d.name) setPathFilter(d.name === pathFilter ? "" : d.name); }}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Top 10 users */}
          <ChartCard title="Top 10 Users">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topUsers} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="Visits"
                  fill={PALETTE[1]}
                  radius={[0, 4, 4, 0]}
                  style={{ cursor: "pointer" }}
                  onClick={(d: { id?: string }) => {
                    if (d.id) toggleUserId(d.id);
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Browser donut */}
          <ChartCard title="Browser Distribution">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byBrowser} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {data.byBrowser.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* OS donut */}
          <ChartCard title="OS Distribution">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byOs} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {data.byOs.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Device type donut */}
          <ChartCard title="Device Type">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byDevice} dataKey="count" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {data.byDevice.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Visits by role */}
          <ChartCard title="Visits by Role">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byRole} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Visits" fill={PALETTE[2]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Visits by hour */}
          <div className="lg:col-span-2">
            <ChartCard title="Visits by Hour of Day (0–23)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.byHour} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="hour" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Visits" fill={PALETTE[4]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      )}

      {/* Detail table */}
      {!loading && data && data.total > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Activity Log{" "}
              <span className="font-normal text-muted-foreground">
                ({data.total.toLocaleString()} rows)
              </span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Page {page} of {totalPages}
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Browser</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead className="whitespace-nowrap">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      {row.userId ? (
                        <button
                          type="button"
                          className="text-left hover:underline focus:underline"
                          onClick={() => row.userId && toggleUserId(row.userId)}
                          title="Filter by this user"
                        >
                          {row.userName ?? row.userId}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.userRole ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.userDept ?? "—"}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="max-w-[200px] truncate text-left font-mono text-xs hover:underline focus:underline"
                        onClick={() => setPathFilter(row.path === pathFilter ? "" : row.path)}
                        title="Filter by this path"
                      >
                        {row.path}
                      </button>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.browser ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.os ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.deviceType ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(row.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
