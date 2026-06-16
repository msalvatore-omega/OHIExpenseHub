"use client";

// Accounting analytics: filters + KPI cards + Recharts (donut, monthly line,
// dept/submitter bars, stacked type-by-month). All derived from ledger entries.

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

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { getDepartments, getLedgerEntries } from "@/lib/data";
import type { AnalyticsFilter, LedgerEntry, ReportStatus } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

const PALETTE = [
  "#0B2545", "#C8A02E", "#1E7A5A", "#C98A1E", "#B23A48",
  "#13315C", "#5B8FC9", "#7C9A92", "#9B6A6C", "#3E6B89",
];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const STATUSES: ReportStatus[] = [
  "DRAFT", "SUBMITTED", "IN_REVIEW", "APPROVED", "REJECTED", "PAID",
];

const money = (v: unknown) => formatCurrency(Number(v));
const top10 = (rows: { name: string; value: number }[]) =>
  [...rows].sort((a, b) => b.value - a.value).slice(0, 10);

function Chip({
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

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="h-64 w-full">{children}</div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function AnalyticsView() {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [departments, setDepartments] = React.useState<string[]>([]);
  const [statuses, setStatuses] = React.useState<ReportStatus[]>([]);

  const filter: AnalyticsFilter = {
    from: from || undefined,
    to: to || undefined,
    departments: departments.length ? departments : undefined,
    statuses: statuses.length ? statuses : undefined,
  };

  const deptOptions = useQuery({ queryKey: ["departments"], queryFn: getDepartments });
  const ledger = useQuery({
    queryKey: ["ledger", filter],
    queryFn: () => getLedgerEntries(filter),
  });

  const entries = ledger.data ?? [];
  const agg = React.useMemo(() => aggregate(entries), [entries]);

  const toggle = <T,>(list: T[], v: T, set: (l: T[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header>
        <h1>Accounting — Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Spend insights across reports, types, and departments.
        </p>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            From
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            To
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </label>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Department</span>
          <div className="flex flex-wrap gap-1.5">
            {(deptOptions.data ?? []).map((d) => (
              <Chip key={d} active={departments.includes(d)} onClick={() => toggle(departments, d, setDepartments)}>
                {d}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map((s) => (
              <Chip key={s} active={statuses.includes(s)} onClick={() => toggle(statuses, s, setStatuses)}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {ledger.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : (
          <>
            <KpiCard label="Total Spend" value={formatCurrency(agg.totalSpend)} />
            <KpiCard label="Total Reports" value={String(agg.totalReports)} />
            <KpiCard label="Avg Amount" value={formatCurrency(agg.avgAmount)} />
            <KpiCard label="Total Reimbursed" value={formatCurrency(agg.totalReimbursed)} />
          </>
        )}
      </section>

      {/* Charts */}
      {entries.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          No data for the selected filters.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Spend by Expense Type">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={agg.byType} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {agg.byType.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={money} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Monthly Trend — This Year vs Prior">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={agg.monthly} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                <Tooltip formatter={money} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="prior" name={String(agg.priorYear)} stroke={PALETTE[6]} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="current" name={String(agg.thisYear)} stroke={PALETTE[0]} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Spend by Department (Top 10)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.byDept} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                <YAxis type="category" dataKey="name" width={110} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={money} />
                <Bar dataKey="value" fill={PALETTE[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top Submitters (Top 10)">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.bySubmitter} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                <YAxis type="category" dataKey="name" width={110} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={money} />
                <Bar dataKey="value" fill={PALETTE[1]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="lg:col-span-2">
            <ChartCard title="Expense Type by Month">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agg.stacked} margin={{ left: 4, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
                  <Tooltip formatter={money} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {agg.typeNames.map((t, i) => (
                    <Bar key={t} dataKey={t} stackId="a" fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- aggregation ----

function aggregate(entries: LedgerEntry[]) {
  const totalSpend = entries.reduce((s, e) => s + e.amount, 0);
  const reportIds = new Set(entries.map((e) => e.reportId));
  const totalReports = reportIds.size;
  const avgAmount = totalReports ? totalSpend / totalReports : 0;
  const totalReimbursed = entries
    .filter((e) => e.status === "PAID")
    .reduce((s, e) => s + e.amount, 0);

  const sumBy = (key: (e: LedgerEntry) => string) => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(key(e), (m.get(key(e)) ?? 0) + e.amount);
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  };

  const byType = sumBy((e) => e.expenseTypeName).sort((a, b) => b.value - a.value);
  const byDept = top10(sumBy((e) => e.department));
  const bySubmitter = top10(sumBy((e) => e.submitterName));

  const thisYear = new Date().getFullYear();
  const priorYear = thisYear - 1;
  const monthly = MONTHS.map((month) => ({ month, current: 0, prior: 0 }));
  for (const e of entries) {
    const d = new Date(e.expenseDate);
    const m = d.getMonth();
    if (d.getFullYear() === thisYear) monthly[m].current += e.amount;
    else if (d.getFullYear() === priorYear) monthly[m].prior += e.amount;
  }

  const typeNames = [...new Set(entries.map((e) => e.expenseTypeName))];
  const stacked = MONTHS.map((month) => {
    const row: Record<string, number | string> = { month };
    for (const t of typeNames) row[t] = 0;
    return row;
  });
  for (const e of entries) {
    const m = new Date(e.expenseDate).getMonth();
    stacked[m][e.expenseTypeName] =
      (stacked[m][e.expenseTypeName] as number) + e.amount;
  }

  return {
    totalSpend,
    totalReports,
    avgAmount,
    totalReimbursed,
    byType,
    byDept,
    bySubmitter,
    monthly,
    stacked,
    typeNames,
    thisYear,
    priorYear,
  };
}
