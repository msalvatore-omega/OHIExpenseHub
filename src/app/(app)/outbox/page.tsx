"use client";

// Mock email outbox — confirms what notifications *would* have been sent.

import { useQuery } from "@tanstack/react-query";

import { getOutbox } from "@/lib/data";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function OutboxPage() {
  const outbox = useQuery({ queryKey: ["outbox"], queryFn: getOutbox });
  const emails = outbox.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header>
        <h1>Outbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Notifications queued by the prototype (no real email is sent).
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead className="text-right">Queued</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {outbox.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 3 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : emails.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No notifications queued yet.
                </TableCell>
              </TableRow>
            ) : (
              emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {email.to}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{email.subject}</p>
                    <p className="max-w-prose truncate text-xs text-muted-foreground">
                      {email.body}
                    </p>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground tabular-nums">
                    {formatTimestamp(email.sentAt)}
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
