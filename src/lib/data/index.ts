// MOCK LAYER — replace bodies with Prisma/fetch for production; keep signatures identical.
//
// This is THE SWAP BOUNDARY. The UI only ever imports from here. Every function
// is async, mirrors a future API/DB call, and simulates network latency so the
// loading states behave like production. When real services arrive, swap the
// bodies (Prisma queries, REST/GraphQL fetches) and leave the signatures alone.

import {
  findReceipt,
  findReport,
  insertApprovalHistory,
  insertEmail,
  insertReport,
  listApprovalHistory,
  listDelegates,
  listExpenseTypes,
  listLineItems,
  listOutbox,
  listReceipts,
  listReports,
  listUsers,
  newId,
  nowIso,
  patchReceipt,
  patchReport,
  recalcReportTotal,
} from "@/lib/data/store";
import { APP_NAME } from "@/lib/constants";
import type {
  ApprovalHistory,
  CreateDraftInput,
  Delegate,
  ExpenseReport,
  ExpenseType,
  Kpis,
  MockEmail,
  Receipt,
  ReceiptFilter,
  ReportDetail,
  ReportFilter,
  User,
} from "@/lib/types";

/** Simulate a 200–500ms round-trip. */
function delay(min = 200, max = 500): Promise<void> {
  const ms = Math.floor(min + Math.random() * (max - min));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function userById(id: string | undefined): User | undefined {
  if (!id) return undefined;
  return listUsers().find((u) => u.id === id);
}

const currency = (amount: number) =>
  amount.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Queue a mock email into the outbox. */
function sendMockEmail(to: string, subject: string, body: string): MockEmail {
  return insertEmail({
    id: newId("email"),
    to,
    subject,
    body,
    sentAt: nowIso(),
  });
}

// ---- KPIs ----

export async function getKpis(): Promise<Kpis> {
  await delay();
  const reports = listReports();
  const sum = (predicate: (r: ExpenseReport) => boolean) =>
    reports.filter(predicate).reduce((acc, r) => acc + r.totalAmount, 0);

  return {
    totalReports: reports.length,
    draftCount: reports.filter((r) => r.status === "DRAFT").length,
    pendingApprovalCount: reports.filter(
      (r) => r.status === "SUBMITTED" || r.status === "IN_REVIEW"
    ).length,
    approvedCount: reports.filter((r) => r.status === "APPROVED").length,
    rejectedCount: reports.filter((r) => r.status === "REJECTED").length,
    paidCount: reports.filter((r) => r.status === "PAID").length,
    totalSubmittedAmount: sum((r) => r.status !== "DRAFT"),
    totalReimbursedAmount: sum((r) => r.status === "PAID"),
  };
}

// ---- Reports ----

export async function getReports(
  filter?: ReportFilter
): Promise<ExpenseReport[]> {
  await delay();
  let reports = [...listReports()];
  if (filter?.status) reports = reports.filter((r) => r.status === filter.status);
  if (filter?.submitterId)
    reports = reports.filter((r) => r.submitterId === filter.submitterId);
  if (filter?.paidToId)
    reports = reports.filter((r) => r.paidToId === filter.paidToId);
  // Most recently updated first.
  return reports.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getReport(id: string): Promise<ReportDetail | null> {
  await delay();
  const report = findReport(id);
  if (!report) return null;
  return {
    ...report,
    lineItems: [...listLineItems(id)].sort((a, b) =>
      a.expenseDate.localeCompare(b.expenseDate)
    ),
    approvalHistory: [...listApprovalHistory(id)].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    ),
  };
}

export async function createDraft(
  input: CreateDraftInput
): Promise<ExpenseReport> {
  await delay();
  const timestamp = nowIso();
  const report: ExpenseReport = {
    id: newId("report"),
    reportName: input.reportName,
    submitterId: input.submitterId,
    onBehalfOfId: input.onBehalfOfId,
    paidToId: input.paidToId,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    status: "DRAFT",
    totalAmount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return insertReport(report);
}

export async function updateReport(
  id: string,
  patch: Partial<ExpenseReport>
): Promise<ExpenseReport> {
  await delay();
  const updated = patchReport(id, patch);
  if (!updated) throw new Error(`Report ${id} not found`);
  return updated;
}

export async function submitReport(id: string): Promise<ExpenseReport> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  recalcReportTotal(id);
  const timestamp = nowIso();
  const updated = patchReport(id, {
    status: "SUBMITTED",
    submittedAt: timestamp,
  })!;

  // Record a pending approval for the submitter's manager (the approver).
  const submitter = userById(report.submitterId);
  const approver = userById(submitter?.managerId ?? undefined);
  if (approver) {
    insertApprovalHistory({
      id: newId("history"),
      reportId: id,
      approverId: approver.id,
      action: "PENDING",
      createdAt: timestamp,
    });
    sendMockEmail(
      approver.email,
      `[${APP_NAME}] Report awaiting your approval: ${report.reportName}`,
      `${submitter?.name ?? "A submitter"} submitted an expense report (${report.reportName}) totaling ${currency(updated.totalAmount)} for your approval.`
    );
  }
  return updated;
}

export async function approveReport(
  id: string,
  comment?: string
): Promise<ExpenseReport> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  const timestamp = nowIso();
  const submitter = userById(report.submitterId);
  const approver = userById(submitter?.managerId ?? undefined);

  insertApprovalHistory({
    id: newId("history"),
    reportId: id,
    approverId: approver?.id ?? "system",
    action: "APPROVED",
    comment,
    createdAt: timestamp,
  });
  const updated = patchReport(id, { status: "APPROVED" })!;

  const recipient = userById(report.paidToId) ?? submitter;
  if (recipient) {
    sendMockEmail(
      recipient.email,
      `[${APP_NAME}] Your report was approved: ${report.reportName}`,
      `Your expense report (${report.reportName}) totaling ${currency(updated.totalAmount)} was approved${comment ? `. Note: ${comment}` : "."}`
    );
  }
  return updated;
}

export async function rejectReport(
  id: string,
  comment?: string
): Promise<ExpenseReport> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  const timestamp = nowIso();
  const submitter = userById(report.submitterId);
  const approver = userById(submitter?.managerId ?? undefined);

  insertApprovalHistory({
    id: newId("history"),
    reportId: id,
    approverId: approver?.id ?? "system",
    action: "REJECTED",
    comment,
    createdAt: timestamp,
  });
  const updated = patchReport(id, { status: "REJECTED" })!;

  const recipient = userById(report.paidToId) ?? submitter;
  if (recipient) {
    sendMockEmail(
      recipient.email,
      `[${APP_NAME}] Your report was rejected: ${report.reportName}`,
      `Your expense report (${report.reportName}) was rejected${approver ? ` by ${approver.name}` : ""}.${comment ? ` Reason: ${comment}` : ""}`
    );
  }
  return updated;
}

export async function markPaid(id: string): Promise<ExpenseReport> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  const updated = patchReport(id, { status: "PAID" })!;
  const recipient = userById(report.paidToId);
  if (recipient) {
    sendMockEmail(
      recipient.email,
      `[${APP_NAME}] Reimbursement paid: ${report.reportName}`,
      `Your reimbursement for (${report.reportName}) totaling ${currency(updated.totalAmount)} has been paid.`
    );
  }
  return updated;
}

// ---- Receipts ----

export async function getReceipts(filter?: ReceiptFilter): Promise<Receipt[]> {
  await delay();
  let receipts = [...listReceipts()];
  if (filter?.userId)
    receipts = receipts.filter((r) => r.userId === filter.userId);
  if (filter?.isAttached !== undefined)
    receipts = receipts.filter((r) => r.isAttached === filter.isAttached);
  return receipts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function attachReceipt(
  reportId: string,
  receiptId: string
): Promise<Receipt> {
  await delay();
  const report = findReport(reportId);
  if (!report) throw new Error(`Report ${reportId} not found`);
  const receipt = findReceipt(receiptId);
  if (!receipt) throw new Error(`Receipt ${receiptId} not found`);
  const updated = patchReceipt(receiptId, { isAttached: true })!;
  return updated;
}

// ---- Reference data ----

export async function getUsers(): Promise<User[]> {
  await delay();
  return [...listUsers()];
}

export async function getDelegatesFor(userId: string): Promise<Delegate[]> {
  await delay();
  return listDelegates().filter((d) => d.principalId === userId);
}

export async function getExpenseTypes(): Promise<ExpenseType[]> {
  await delay();
  return [...listExpenseTypes()];
}

// ---- Mock email outbox ----

export async function getOutbox(): Promise<MockEmail[]> {
  await delay();
  return [...listOutbox()].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

// Re-export approval history type consumers may want alongside the layer.
export type { ApprovalHistory };
