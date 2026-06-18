"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CornerUpLeft, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import {
  approveReport,
  getApprovalGroups,
  getReport,
  getUsers,
  rejectReport,
  savePendingNote,
  sendBackReport,
} from "@/lib/data";
import { toastQueuedNotifications } from "@/lib/notify";
import { useSession } from "@/lib/auth/mock-session";
import { dashboardKeys } from "@/components/dashboard/use-dashboard-data";
import { ReportExportButtons } from "@/components/reports/report-export-buttons";
import { ReportDetailView } from "@/components/reports/report-detail-view";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ReportDetail } from "@/lib/types";

function stepLabelFromReport(report: ReportDetail | null | undefined): string {
  if (!report) return "Notes";
  const { status, approvalHistory } = report;
  if (status === "ACCOUNTING_REVIEW") return "Accounting Approval";
  if (status === "EXECUTIVE_REVIEW") return "Executive Approval";
  const approvedCount = approvalHistory.filter((h) => h.action === "APPROVED").length;
  return `Approver ${approvedCount + 1}`;
}

export function ApprovalDetail({ reportId }: { reportId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useSession();

  const reportQuery = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId),
  });
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const groupsQuery = useQuery({
    queryKey: ["approval-groups"],
    queryFn: getApprovalGroups,
  });

  const nameById = new Map((usersQuery.data ?? []).map((u) => [u.id, u.name]));
  const groupNameById = new Map(
    (groupsQuery.data ?? []).map((g) => [g.group.id, g.group.name])
  );

  const [comment, setComment] = React.useState("");
  const commentInitialized = React.useRef(false);
  const [sendBackOpen, setSendBackOpen] = React.useState(false);
  const [sendBackReason, setSendBackReason] = React.useState("");

  const autosaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pre-populate the note textarea from the auto-saved PENDING entry on first load.
  React.useEffect(() => {
    const report = reportQuery.data;
    if (!report || commentInitialized.current) return;
    commentInitialized.current = true;
    const history = [...report.approvalHistory].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt)
    );
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].action === "PENDING") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setComment(history[i].comment ?? "");
        break;
      }
      break;
    }
  }, [reportQuery.data, commentInitialized]);

  // Cleanup timer on unmount.
  React.useEffect(
    () => () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    },
    []
  );

  const afterDecision = () => {
    queryClient.invalidateQueries({ queryKey: ["report", reportId] });
    queryClient.invalidateQueries({ queryKey: ["approval-queue"] });
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    router.push("/approvals");
  };

  const approveMutation = useMutation({
    mutationFn: () => approveReport(reportId, user.id, comment.trim() || undefined),
    onSuccess: (result) => {
      toastQueuedNotifications(result.notifications);
      afterDecision();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectReport(reportId, user.id, comment.trim()),
    onSuccess: (result) => {
      toastQueuedNotifications(result.notifications);
      afterDecision();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not reject"),
  });

  const sendBackMutation = useMutation({
    mutationFn: () => sendBackReport(reportId, user.id, sendBackReason.trim()),
    onSuccess: (result) => {
      toastQueuedNotifications(result.notifications);
      setSendBackOpen(false);
      setSendBackReason("");
      afterDecision();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not send back"),
  });

  const handleCommentChange = (text: string) => {
    setComment(text);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      savePendingNote(reportId, user.id, text.trim()).then((result) => {
        if (result.resolved) {
          toast.info("This step has been completed by another reviewer.");
          queryClient.invalidateQueries({ queryKey: ["report", reportId] });
          queryClient.invalidateQueries({ queryKey: ["approval-queue"] });
        }
      });
    }, 1500);
  };

  const busy =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    sendBackMutation.isPending;

  const status = reportQuery.data?.status;
  const open =
    status === "SUBMITTED" ||
    status === "IN_REVIEW" ||
    status === "ACCOUNTING_REVIEW" ||
    status === "EXECUTIVE_REVIEW";

  const stepLabel = stepLabelFromReport(reportQuery.data);

  // Non-pending history entries for the compact history panel (oldest first).
  const priorHistory = React.useMemo(
    () =>
      (reportQuery.data?.approvalHistory ?? [])
        .filter((h) => h.action !== "PENDING")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [reportQuery.data?.approvalHistory]
  );

  const decisionPanel = open ? (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 backdrop-blur md:bottom-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-6 py-3">
        {/* Prior approver notes */}
        {priorHistory.length > 0 && (
          <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="mb-1.5 text-xs font-semibold text-muted-foreground">
              Approval history
            </p>
            <ol className="flex flex-col gap-2">
              {priorHistory.map((h) => {
                const isApproved = h.action === "APPROVED";
                const actorName = h.approvalGroupId
                  ? `${groupNameById.get(h.approvalGroupId) ?? "Group"}${
                      h.approverId
                        ? ` (${nameById.get(h.approverId) ?? "—"})`
                        : ""
                    }`
                  : (nameById.get(h.approverId) ?? "System");
                return (
                  <li key={h.id} className="flex gap-2 text-xs">
                    {isApproved ? (
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-600" />
                    )}
                    <div className="min-w-0">
                      <span className={cn("font-medium", isApproved ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                        {isApproved ? "Approved" : "Rejected"}
                      </span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{actorName}</span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{formatDate(h.createdAt)}</span>
                      {h.comment && (
                        <p className="mt-0.5 rounded bg-background px-1.5 py-0.5 italic text-muted-foreground">
                          {h.comment}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Current step note */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            {stepLabel} notes
          </label>
          <Textarea
            placeholder="Write a note (required to reject)…"
            value={comment}
            onChange={(e) => handleCommentChange(e.target.value)}
            rows={2}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950"
            disabled={busy || comment.trim().length === 0}
            onClick={() => rejectMutation.mutate()}
          >
            {rejectMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <XCircle className="size-4" />
            )}
            Reject
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => setSendBackOpen(true)}
          >
            <CornerUpLeft className="size-4" />
            Send back to employee
          </Button>
          <Button
            className="bg-green-600 text-white hover:bg-green-700"
            disabled={busy}
            onClick={() => approveMutation.mutate()}
          >
            {approveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Approve
          </Button>
        </div>
      </div>

      {/* Send back to employee — requires a reason */}
      <Dialog
        open={sendBackOpen}
        onOpenChange={(o) => {
          if (busy) return;
          setSendBackOpen(o);
          if (!o) setSendBackReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send back to employee</DialogTitle>
            <DialogDescription>
              The report returns to the employee&apos;s drafts to edit and
              resubmit. Resubmitting restarts approval from the first approver.
              A reason is required.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for returning this report…"
            value={sendBackReason}
            onChange={(e) => setSendBackReason(e.target.value)}
            rows={3}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              disabled={sendBackMutation.isPending}
              onClick={() => {
                setSendBackOpen(false);
                setSendBackReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                sendBackMutation.isPending || sendBackReason.trim().length === 0
              }
              onClick={() => sendBackMutation.mutate()}
            >
              {sendBackMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CornerUpLeft className="size-4" />
              )}
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  ) : null;

  return (
    <ReportDetailView
      reportId={reportId}
      actions={<ReportExportButtons reportId={reportId} />}
      footer={decisionPanel}
      reserveBottomSpace={open}
    />
  );
}
