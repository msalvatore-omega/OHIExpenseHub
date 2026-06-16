"use client";

// Approval routing table: active (non-DRAFT, non-PAID) reports the current user
// is involved in, as submitter or approver.

import { formatCurrency } from "@/lib/format";
import { useRouting } from "@/components/dashboard/use-dashboard-data";
import { StatusPill } from "@/components/status-pill";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function RoutingTable({ userId }: { userId: string }) {
  const routing = useRouting(userId);
  const rows = routing.data ?? [];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Approval routing
      </h2>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report Name</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Approver</TableHead>
              <TableHead>Step</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {routing.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No active reports in routing.
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ report, submitterName, approverName, step }) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">
                    <span className="block truncate">{report.reportName}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatCurrency(report.totalAmount)}
                    </span>
                  </TableCell>
                  <TableCell>{submitterName}</TableCell>
                  <TableCell>{approverName}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {step}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusPill status={report.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
