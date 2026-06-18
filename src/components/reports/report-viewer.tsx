"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, XCircle } from "lucide-react";

import { formatDateTime } from "@/lib/format";
import {
  canViewReport,
  getApprovalChainInfo,
  getReport,
  getUsers,
} from "@/lib/data";
import { useSession } from "@/lib/auth/mock-session";
import { ApprovalChainStepper } from "@/components/reports/approval-chain-stepper";
import { ReportDetailView } from "@/components/reports/report-detail-view";
import { ReportExportButtons } from "@/components/reports/report-export-buttons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function ReportViewer({ reportId }: { reportId: string }) {
  const { user } = useSession();
  const router = useRouter();

  const accessQuery = useQuery({
    queryKey: ["report-access", reportId, user.id],
    queryFn: () => canViewReport(reportId, user.id),
  });

  const chainQuery = useQuery({
    queryKey: ["approval-chain", reportId],
    queryFn: () => getApprovalChainInfo(reportId),
  });

  const reportQuery = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId),
  });

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: getUsers });

  if (accessQuery.isLoading || chainQuery.isLoading || reportQuery.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (accessQuery.data === false) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground">
          You don&apos;t have permission to view this report.
        </p>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="w-fit"
        >
          <ArrowLeft className="size-4" />
          Go back
        </Button>
      </div>
    );
  }

  const nameById = new Map(
    (usersQuery.data ?? []).map((u) => [u.id, u.name])
  );
  const report = reportQuery.data;

  const rejectionHistory = (report?.approvalHistory ?? [])
    .filter((h) => h.action === "REJECTED")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const midContent =
    rejectionHistory.length > 0 ? (
      <section className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/20">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-red-700 dark:text-red-400">
          <XCircle className="size-4 shrink-0" />
          Rejection History
        </h2>
        <ol className="flex flex-col gap-3">
          {rejectionHistory.map((h) => (
            <li
              key={h.id}
              className="flex flex-col gap-1.5 rounded-lg border border-red-200 bg-background p-3 dark:border-red-900"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-semibold text-red-700 dark:text-red-400">
                  {nameById.get(h.approverId) ?? "Reviewer"}
                </span>
                <span>·</span>
                <span>{formatDateTime(h.createdAt)}</span>
              </div>
              {h.comment && (
                <p className="rounded bg-red-50 px-2.5 py-1.5 text-sm leading-snug text-red-900 dark:bg-red-950/40 dark:text-red-200">
                  {h.comment}
                </p>
              )}
            </li>
          ))}
        </ol>
      </section>
    ) : undefined;

  return (
    <div className="flex flex-col">
      {/* Back navigation */}
      <div className="mx-auto w-full max-w-3xl px-6 pt-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="-ml-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      {/* Approval chain stepper */}
      {chainQuery.data && (
        <div className="border-b border-border bg-muted/20">
          <div className="mx-auto w-full max-w-3xl px-6 py-5">
            <ApprovalChainStepper
              chainInfo={chainQuery.data}
              reportStatus={report?.status}
            />
          </div>
        </div>
      )}

      {/* Read-only report content */}
      <ReportDetailView
        reportId={reportId}
        actions={<ReportExportButtons reportId={reportId} />}
        midContent={midContent}
      />
    </div>
  );
}
