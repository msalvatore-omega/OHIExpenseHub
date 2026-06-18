"use client";

import * as React from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { StatusPill } from "@/components/status-pill";
import type {
  ApprovalChainInfoResult,
  ApprovalChainStepDisplay,
  ChainStepStatus,
  ReportStatus,
} from "@/lib/types";

const STEP_STYLE: Record<
  ChainStepStatus,
  {
    Icon: typeof Clock;
    containerClass: string;
    iconClass: string;
    labelClass: string;
  }
> = {
  approved: {
    Icon: CheckCircle2,
    containerClass:
      "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
    iconClass: "text-green-600 dark:text-green-400",
    labelClass: "text-green-700 dark:text-green-400",
  },
  current: {
    Icon: Clock,
    containerClass:
      "border-blue-300 bg-blue-50 ring-1 ring-blue-200 dark:border-blue-700 dark:bg-blue-950/30 dark:ring-blue-800",
    iconClass: "text-blue-600 dark:text-blue-400",
    labelClass: "text-blue-700 dark:text-blue-400",
  },
  pending: {
    Icon: Circle,
    containerClass: "border-border bg-muted/30",
    iconClass: "text-muted-foreground",
    labelClass: "text-foreground",
  },
  rejected: {
    Icon: XCircle,
    containerClass:
      "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
    iconClass: "text-red-600 dark:text-red-400",
    labelClass: "text-red-700 dark:text-red-400",
  },
};

function StepCard({ step }: { step: ApprovalChainStepDisplay }) {
  const { Icon, containerClass, iconClass, labelClass } =
    STEP_STYLE[step.status];
  const isCurrent = step.status === "current";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border p-2.5",
        containerClass
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          className={cn(
            "size-3.5 shrink-0",
            iconClass,
            isCurrent && "animate-pulse"
          )}
        />
        <span className={cn("truncate text-xs font-semibold", labelClass)}>
          {step.label}
        </span>
      </div>
      <p className="truncate text-xs text-muted-foreground">
        {step.actedByName ?? step.actorDisplay}
      </p>
      {step.actedAt && step.status !== "pending" && (
        <p className="text-[10px] text-muted-foreground">
          {formatDateTime(step.actedAt)}
        </p>
      )}
      {step.note && (
        <p className="line-clamp-2 text-[10px] italic text-muted-foreground">
          {step.note}
        </p>
      )}
      {isCurrent && (
        <span className={cn("text-[10px] font-medium", labelClass)}>
          Awaiting review
        </span>
      )}
    </div>
  );
}

export function ApprovalChainStepper({
  chainInfo,
  reportStatus,
}: {
  chainInfo: ApprovalChainInfoResult;
  reportStatus?: ReportStatus;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Approval status
        </span>
        {reportStatus && <StatusPill status={reportStatus} />}
        {chainInfo.fastTracked && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            Fast-tracked
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5 md:flex-row md:items-start md:gap-0">
        {chainInfo.steps.map((step, i) => (
          <React.Fragment key={step.label + i}>
            {i > 0 && (
              <div className="flex items-center justify-center md:px-1 md:pt-3">
                <ChevronDown className="size-3.5 text-muted-foreground md:hidden" />
                <ChevronRight className="hidden size-3.5 text-muted-foreground md:block" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <StepCard step={step} />
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
