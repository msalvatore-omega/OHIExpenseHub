"use client";

// Approvals list — reports awaiting the current user (APPROVER + ADMIN).

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { formatCurrency, formatDate } from "@/lib/format";
import { getApprovalQueue, getUsers } from "@/lib/data";
import { useSession } from "@/lib/auth/mock-session";
import { RoleGuard } from "@/components/role-guard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ApprovalsPage() {
  return (
    <RoleGuard allow={["APPROVER", "ADMIN", "ACCOUNTING"]}>
      <ApprovalsList />
    </RoleGuard>
  );
}

function ApprovalsList() {
  const { user } = useSession();

  const queue = useQuery({
    queryKey: ["approval-queue", user.id],
    queryFn: () => getApprovalQueue(user.id),
  });
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const nameById = new Map((users.data ?? []).map((u) => [u.id, u.name]));

  const rows = queue.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header>
        <h1>Approvals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reports awaiting your review.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Report Name</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Paid To</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  Nothing awaiting your approval.
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ report, submitterName }) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">
                    {report.reportName}
                  </TableCell>
                  <TableCell>{submitterName}</TableCell>
                  <TableCell>
                    {nameById.get(report.paidToId) ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(report.periodFrom)} – {formatDate(report.periodTo)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(report.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      nativeButton={false}
                      render={<Link href={`/approvals/${report.id}`} />}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
