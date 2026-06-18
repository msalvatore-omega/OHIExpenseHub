"use client";

// Approval routing table: active (non-DRAFT, non-PAID) reports the current user
// is involved in, as submitter or approver.

import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const routing = useRouting(userId);
  const rows = routing.data ?? [];

  return (
    // Desktop only — on mobile the routing table is hidden; users work from the
    // Home action buttons instead.
    <section className="hidden flex-col gap-3 md:flex">
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
              rows.map(
                ({ report, submitterName, approverName, step, fastTracked }) => (
                  <TableRow
                    key={report.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => router.push(`/reports/${report.id}/view`)}
                  >
                    <TableCell className="font-medium">
                      <span className="block truncate">{report.reportName}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatCurrency(report.totalAmount)}
                      </span>
                    </TableCell>
                    <TableCell>{submitterName}</TableCell>
                    <TableCell>{approverName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{step}</span>
                        {fastTracked && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Fast-tracked
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusPill status={report.status} />
                    </TableCell>
                  </TableRow>
                )
              )
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
