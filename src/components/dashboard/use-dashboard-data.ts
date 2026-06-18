"use client";

// Shared React Query hooks + keys for the dashboard. Components co-locate their
// data needs here so they share a single cache entry per query.

import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getApprovalQueue,
  getDraftRejectionIds,
  getMyReports,
  getRoutingForUser,
} from "@/lib/data";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  myReports: (userId: string) => ["dashboard", "my-reports", userId] as const,
  approvalQueue: (userId: string) =>
    ["dashboard", "approval-queue", userId] as const,
  routing: (userId: string) => ["dashboard", "routing", userId] as const,
};

export function useMyReports(userId: string) {
  return useQuery({
    queryKey: dashboardKeys.myReports(userId),
    queryFn: () => getMyReports(userId),
  });
}

export function useApprovalQueue(userId: string) {
  return useQuery({
    queryKey: dashboardKeys.approvalQueue(userId),
    queryFn: () => getApprovalQueue(userId),
  });
}

export function useRouting(userId: string) {
  return useQuery({
    queryKey: dashboardKeys.routing(userId),
    queryFn: () => getRoutingForUser(userId),
  });
}

export function useDraftRejectionIds(userId: string) {
  return useQuery({
    queryKey: ["dashboard", "draft-rejections", userId] as const,
    queryFn: () => getDraftRejectionIds(userId),
    select: (ids) => new Set(ids),
  });
}

/** Invalidate every dashboard query (after a mutation). */
export function useInvalidateDashboard() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
}
