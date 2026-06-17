"use client";

// Per-report audit trail. ChangeHistoryDialog is a controlled popup listing one
// report's changes (Date & Time | Type of Change | Changed By, with an old → new
// details line). ChangeHistoryButton bundles a trigger button with the dialog.

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import { getReportChangeLogs, getUsers } from "@/lib/data";
import type { ReportChangeType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const TYPE_LABEL: Record<ReportChangeType, string> = {
  STATUS: "Status",
  AMOUNT: "Amount",
  LINE_ITEM: "Line item",
  FIELD: "Field",
  OTHER: "Other",
};

export function ChangeHistoryDialog({
  reportId,
  open,
  onOpenChange,
}: {
  reportId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const logs = useQuery({
    queryKey: ["report-change-log", reportId],
    queryFn: () => getReportChangeLogs(reportId as string),
    enabled: open && !!reportId,
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    enabled: open,
  });
  const nameById = new Map((users.data ?? []).map((u) => [u.id, u.name]));

  const rows = logs.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Change History</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          {logs.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
              No changes recorded for this report.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date &amp; Time</TableHead>
                  <TableHead>Type of Change</TableHead>
                  <TableHead>Changed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(c.changedAt)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="font-medium">{TYPE_LABEL[c.changeType]}</div>
                      <div className="text-xs text-muted-foreground">
                        {c.summary}
                      </div>
                      {c.oldValue != null && c.newValue != null && (
                        <div className="mt-0.5 text-xs">
                          <span className="text-muted-foreground line-through">
                            {c.oldValue}
                          </span>
                          <span className="mx-1 text-muted-foreground">→</span>
                          <span className="font-medium">{c.newValue}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {nameById.get(c.changedById) ?? "System"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A button that opens the per-report Change History dialog. */
export function ChangeHistoryButton({ reportId }: { reportId: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <History className="size-4" />
        Change History
      </Button>
      <ChangeHistoryDialog
        reportId={reportId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
