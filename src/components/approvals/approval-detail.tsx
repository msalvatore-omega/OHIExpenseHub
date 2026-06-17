"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  approveReport,
  getReport,
  rejectReport,
} from "@/lib/data";
import { toastQueuedNotifications } from "@/lib/notify";
import { dashboardKeys } from "@/components/dashboard/use-dashboard-data";
import { ReportExportButtons } from "@/components/reports/report-export-buttons";
import { ReportDetailView } from "@/components/reports/report-detail-view";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ApprovalDetail({ reportId }: { reportId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const reportQuery = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId),
  });

  const [comment, setComment] = React.useState("");

  const afterDecision = () => {
    queryClient.invalidateQueries({ queryKey: ["report", reportId] });
    queryClient.invalidateQueries({ queryKey: ["approval-queue"] });
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    router.push("/approvals");
  };

  const approveMutation = useMutation({
    mutationFn: () => approveReport(reportId, comment.trim() || undefined),
    onSuccess: (result) => {
      toastQueuedNotifications(result.notifications);
      afterDecision();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not approve"),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectReport(reportId, comment.trim()),
    onSuccess: (result) => {
      toastQueuedNotifications(result.notifications);
      afterDecision();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not reject"),
  });

  const busy = approveMutation.isPending || rejectMutation.isPending;
  const status = reportQuery.data?.status;
  const open = status === "SUBMITTED" || status === "IN_REVIEW";

  const decisionPanel = open ? (
    <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 backdrop-blur md:bottom-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-3">
        <Textarea
          placeholder="Add a comment (required to reject)…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={2}
        />
        <div className="flex justify-end gap-2">
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
