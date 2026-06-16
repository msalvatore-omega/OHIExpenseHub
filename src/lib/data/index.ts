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
  insertReceipt,
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
  insertDelegate,
  insertExpenseType,
  patchExpenseType,
  patchReceipt,
  patchReport,
  patchUser,
  recalcReportTotal,
  removeDelegate,
  removeReport,
  replaceLineItemsForReport,
} from "@/lib/data/store";
import { APP_NAME, MILEAGE_RATE } from "@/lib/constants";
import type {
  AccountingReportRow,
  AnalyticsFilter,
  ApprovalActionResult,
  ApprovalHistory,
  CreateDraftInput,
  CreateReceiptInput,
  Delegate,
  DelegateInput,
  ExpenseTypeInput,
  LedgerEntry,
  ExpenseLineItem,
  ExpenseReport,
  ExpenseType,
  Kpis,
  LineItemInput,
  MockEmail,
  Receipt,
  ReceiptFilter,
  ReportDetail,
  ReportFilter,
  ReportRoutingRow,
  ReportStatus,
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

function userName(id: string | undefined): string {
  return userById(id)?.name ?? "—";
}

/** The approver currently/most-recently associated with a report. */
function currentApproverId(report: ExpenseReport): string | undefined {
  const history = listApprovalHistory(report.id);
  const decision = [...history]
    .reverse()
    .find((h) => h.action === "APPROVED" || h.action === "REJECTED");
  if (decision) return decision.approverId;
  const pending = [...history].reverse().find((h) => h.action === "PENDING");
  if (pending) return pending.approverId;
  return userById(report.submitterId)?.managerId ?? undefined;
}

/** The approver a report is currently waiting on (only meaningful while open). */
function pendingApproverId(report: ExpenseReport): string | undefined {
  const pending = [...listApprovalHistory(report.id)]
    .reverse()
    .find((h) => h.action === "PENDING");
  return pending?.approverId;
}

/** Human-readable workflow step, e.g. "1 of 1". */
function stepLabel(report: ExpenseReport): string {
  const history = listApprovalHistory(report.id);
  const total = Math.max(1, new Set(history.map((h) => h.approverId)).size);
  const decisions = history.filter(
    (h) => h.action === "APPROVED" || h.action === "REJECTED"
  ).length;
  const open = report.status === "SUBMITTED" || report.status === "IN_REVIEW";
  const current = open ? Math.min(decisions + 1, total) : total;
  return `${current} of ${total}`;
}

function involvesUser(report: ExpenseReport, userId: string): boolean {
  return (
    report.submitterId === userId ||
    report.onBehalfOfId === userId ||
    report.paidToId === userId
  );
}

function toRoutingRow(report: ExpenseReport): ReportRoutingRow {
  return {
    report,
    submitterName: userName(report.submitterId),
    approverName: userName(currentApproverId(report)),
    step: stepLabel(report),
  };
}

const OPEN_STATUSES: ReportStatus[] = ["SUBMITTED", "IN_REVIEW"];
const ACTIVE_STATUSES: ReportStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
];

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

/** The accounting mailbox a payment-ready notice goes to. */
function accountingEmail(): string {
  return (
    listUsers().find((u) => u.role === "ACCOUNTING")?.email ??
    "accounting@ohi.example.com"
  );
}

/** Throw with a clear message if a report isn't ready to submit. */
function assertSubmittable(report: ExpenseReport): void {
  if (report.status !== "DRAFT") {
    throw new Error("Only draft reports can be submitted.");
  }
  if (!report.reportName?.trim()) {
    throw new Error("Report name is required.");
  }
  if (!report.periodFrom || !report.periodTo) {
    throw new Error("Reporting period is required.");
  }
  const items = listLineItems(report.id);
  if (items.length === 0) {
    throw new Error("Add at least one line item before submitting.");
  }
  const mileageTypeIds = new Set(
    listExpenseTypes().filter((t) => t.isMileage).map((t) => t.id)
  );
  for (const li of items) {
    if (
      !li.expenseDate ||
      !li.purposeOfTrip ||
      !li.description ||
      !li.city ||
      !li.state ||
      !li.country ||
      !li.expenseTypeId
    ) {
      throw new Error("Every line item must have all fields completed.");
    }
    const effective = mileageTypeIds.has(li.expenseTypeId)
      ? li.miles ?? 0
      : li.amount ?? 0;
    if (effective <= 0) {
      throw new Error("Every line item must have a positive amount.");
    }
  }
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

export async function deleteReport(id: string): Promise<void> {
  await delay();
  const ok = removeReport(id);
  if (!ok) throw new Error(`Report ${id} not found`);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Replace a report's line items wholesale, normalizing mileage rows
 * (amount = miles * rate) and recomputing the report total.
 */
export async function replaceLineItems(
  reportId: string,
  items: LineItemInput[]
): Promise<ExpenseLineItem[]> {
  await delay();
  const report = findReport(reportId);
  if (!report) throw new Error(`Report ${reportId} not found`);

  const mileageTypeIds = new Set(
    listExpenseTypes().filter((t) => t.isMileage).map((t) => t.id)
  );

  const normalized: ExpenseLineItem[] = items.map((it) => {
    const isMileage = mileageTypeIds.has(it.expenseTypeId);
    const miles = isMileage ? it.miles : undefined;
    const calculatedAmount =
      isMileage && miles != null ? round2(miles * MILEAGE_RATE) : undefined;
    const amount = isMileage ? calculatedAmount ?? 0 : it.amount ?? 0;
    return {
      id: it.id ?? newId("line"),
      reportId,
      expenseDate: it.expenseDate,
      purposeOfTrip: it.purposeOfTrip,
      description: it.description,
      city: it.city,
      state: it.state,
      country: it.country,
      expenseTypeId: it.expenseTypeId,
      amount,
      miles,
      calculatedAmount,
      receiptId: it.receiptId,
    };
  });

  replaceLineItemsForReport(reportId, normalized);
  recalcReportTotal(reportId);
  return normalized;
}

export async function submitReport(id: string): Promise<ApprovalActionResult> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);
  assertSubmittable(report);

  recalcReportTotal(id);
  const timestamp = nowIso();
  const updated = patchReport(id, {
    status: "SUBMITTED",
    submittedAt: timestamp,
  })!;

  // Approver = submitter's manager; fall back to the first ADMIN.
  const submitter = userById(report.submitterId);
  const approver =
    userById(submitter?.managerId ?? undefined) ??
    listUsers().find((u) => u.role === "ADMIN");

  const notifications: MockEmail[] = [];
  if (approver) {
    insertApprovalHistory({
      id: newId("history"),
      reportId: id,
      approverId: approver.id,
      action: "PENDING",
      createdAt: timestamp,
    });
    notifications.push(
      sendMockEmail(
        approver.email,
        `Action Required: ${report.reportName} needs your approval`,
        `${submitter?.name ?? "A submitter"} submitted an expense report (${report.reportName}) totaling ${currency(updated.totalAmount)} for your approval.`
      )
    );
  }
  return { report: updated, notifications };
}

export async function approveReport(
  id: string,
  comment?: string
): Promise<ApprovalActionResult> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  const timestamp = nowIso();
  const submitter = userById(report.submitterId);
  const approverId =
    pendingApproverId(report) ?? currentApproverId(report) ?? "system";

  insertApprovalHistory({
    id: newId("history"),
    reportId: id,
    approverId,
    action: "APPROVED",
    comment,
    createdAt: timestamp,
  });
  const updated = patchReport(id, { status: "APPROVED" })!;

  const notifications: MockEmail[] = [];
  const recipient = userById(report.paidToId) ?? submitter;
  if (recipient) {
    notifications.push(
      sendMockEmail(
        recipient.email,
        `Approved: ${report.reportName}`,
        `Your expense report (${report.reportName}) totaling ${currency(updated.totalAmount)} was approved${comment ? `. Note: ${comment}` : "."}`
      )
    );
  }
  notifications.push(
    sendMockEmail(
      accountingEmail(),
      `Ready for Payment: ${report.reportName}`,
      `${report.reportName} (${currency(updated.totalAmount)}) for ${userName(report.paidToId)} has been approved and is ready for payment.`
    )
  );
  return { report: updated, notifications };
}

export async function rejectReport(
  id: string,
  comment?: string
): Promise<ApprovalActionResult> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  const timestamp = nowIso();
  const submitter = userById(report.submitterId);
  const approverId =
    pendingApproverId(report) ?? currentApproverId(report) ?? "system";

  insertApprovalHistory({
    id: newId("history"),
    reportId: id,
    approverId,
    action: "REJECTED",
    comment,
    createdAt: timestamp,
  });
  const updated = patchReport(id, { status: "REJECTED" })!;

  const notifications: MockEmail[] = [];
  const recipient = userById(report.paidToId) ?? submitter;
  if (recipient) {
    notifications.push(
      sendMockEmail(
        recipient.email,
        `Changes Requested: ${report.reportName}`,
        `Your expense report (${report.reportName}) was rejected by ${userName(approverId)}.${comment ? ` Reason: ${comment}` : ""}`
      )
    );
  }
  return { report: updated, notifications };
}

export async function markPaid(id: string): Promise<ApprovalActionResult> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  const updated = patchReport(id, { status: "PAID" })!;
  const notifications: MockEmail[] = [];
  const recipient = userById(report.paidToId);
  if (recipient) {
    notifications.push(
      sendMockEmail(
        recipient.email,
        `Reimbursement Paid: ${report.reportName}`,
        `Your reimbursement for (${report.reportName}) totaling ${currency(updated.totalAmount)} has been paid.`
      )
    );
  }
  return { report: updated, notifications };
}

// ---- Dashboard / personal views ----

/** Reports the user owns (as submitter, on-behalf subject, or payee). */
export async function getMyReports(userId: string): Promise<ExpenseReport[]> {
  await delay();
  return listReports()
    .filter((r) => involvesUser(r, userId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Open reports currently awaiting the given approver, enriched for display. */
export async function getApprovalQueue(
  approverId: string
): Promise<ReportRoutingRow[]> {
  await delay();
  return listReports()
    .filter(
      (r) =>
        OPEN_STATUSES.includes(r.status) && pendingApproverId(r) === approverId
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toRoutingRow);
}

/** Active (non-DRAFT, non-PAID) reports the user is involved in, for routing. */
export async function getRoutingForUser(
  userId: string
): Promise<ReportRoutingRow[]> {
  await delay();
  return listReports()
    .filter(
      (r) =>
        ACTIVE_STATUSES.includes(r.status) &&
        (involvesUser(r, userId) || currentApproverId(r) === userId)
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toRoutingRow);
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

/** Persist a newly captured receipt (starts unattached). */
export async function createReceipt(
  input: CreateReceiptInput
): Promise<Receipt> {
  await delay();
  return insertReceipt({
    id: newId("receipt"),
    userId: input.userId,
    imageUrl: input.imageUrl,
    merchantName: input.merchantName,
    merchantDate: input.merchantDate,
    totalAmount: input.totalAmount,
    taxAmount: input.taxAmount,
    rawOcrData: input.rawOcrData,
    isAttached: false,
    createdAt: nowIso(),
  });
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

/** Principals the given user may submit on behalf of (active delegations). */
export async function getDelegatedPrincipals(
  delegateId: string
): Promise<User[]> {
  await delay();
  const principalIds = new Set(
    listDelegates()
      .filter((d) => d.delegateId === delegateId && d.isActive)
      .map((d) => d.principalId)
  );
  return listUsers().filter((u) => principalIds.has(u.id));
}

export async function getExpenseTypes(): Promise<ExpenseType[]> {
  await delay();
  return [...listExpenseTypes()];
}

// ---- Accounting / analytics ----

/** Flatten every line item with its report + people + type metadata. */
function buildLedger(): LedgerEntry[] {
  const userById = new Map(listUsers().map((u) => [u.id, u]));
  const typeById = new Map(listExpenseTypes().map((t) => [t.id, t]));
  const reportById = new Map(listReports().map((r) => [r.id, r]));

  return listLineItems().flatMap((li) => {
    const report = reportById.get(li.reportId);
    if (!report) return [];
    const submitter = userById.get(report.submitterId);
    const type = typeById.get(li.expenseTypeId);
    return [
      {
        lineItemId: li.id,
        reportId: report.id,
        reportName: report.reportName,
        status: report.status,
        submitterId: report.submitterId,
        submitterName: submitter?.name ?? "—",
        department: submitter?.department ?? "—",
        paidToId: report.paidToId,
        paidToName: userById.get(report.paidToId)?.name ?? "—",
        expenseTypeId: li.expenseTypeId,
        expenseTypeName: type?.displayName ?? "—",
        accountingCode: type?.accountingCode ?? "",
        amount: li.amount,
        expenseDate: li.expenseDate,
        periodFrom: report.periodFrom,
        periodTo: report.periodTo,
      },
    ];
  });
}

function entryMatches(e: LedgerEntry, filter?: AnalyticsFilter): boolean {
  if (filter?.statuses?.length && !filter.statuses.includes(e.status)) return false;
  if (filter?.departments?.length && !filter.departments.includes(e.department))
    return false;
  if (filter?.from && e.expenseDate < filter.from) return false;
  if (filter?.to && e.expenseDate > filter.to) return false;
  return true;
}

export async function getLedgerEntries(
  filter?: AnalyticsFilter
): Promise<LedgerEntry[]> {
  await delay();
  return buildLedger().filter((e) => entryMatches(e, filter));
}

/** Resolve specific line items (used by duplicate detection display). */
export async function getLineItemDetails(ids: string[]): Promise<LedgerEntry[]> {
  await delay();
  const set = new Set(ids);
  return buildLedger().filter((e) => set.has(e.lineItemId));
}

export async function getDepartments(): Promise<string[]> {
  await delay();
  return [...new Set(listUsers().map((u) => u.department))].sort();
}

export async function getAccountingReports(
  filter?: AnalyticsFilter
): Promise<AccountingReportRow[]> {
  await delay();
  const userById = new Map(listUsers().map((u) => [u.id, u]));
  return listReports()
    .filter((r) => {
      if (filter?.statuses?.length && !filter.statuses.includes(r.status))
        return false;
      const dept = userById.get(r.submitterId)?.department ?? "—";
      if (filter?.departments?.length && !filter.departments.includes(dept))
        return false;
      if (filter?.from && r.periodTo < filter.from) return false;
      if (filter?.to && r.periodFrom > filter.to) return false;
      return true;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((r) => ({
      report: r,
      submitterName: userById.get(r.submitterId)?.name ?? "—",
      paidToName: userById.get(r.paidToId)?.name ?? "—",
      department: userById.get(r.submitterId)?.department ?? "—",
    }));
}

// ---- Admin CRUD ----

export async function updateUser(
  id: string,
  patch: Partial<User>
): Promise<User> {
  await delay();
  const user = patchUser(id, patch);
  if (!user) throw new Error(`User ${id} not found`);
  return user;
}

export async function getDelegates(): Promise<Delegate[]> {
  await delay();
  return [...listDelegates()];
}

export async function createDelegate(input: DelegateInput): Promise<Delegate> {
  await delay();
  return insertDelegate({
    id: newId("delegate"),
    principalId: input.principalId,
    delegateId: input.delegateId,
    isActive: true,
  });
}

export async function deleteDelegate(id: string): Promise<void> {
  await delay();
  if (!removeDelegate(id)) throw new Error(`Delegate ${id} not found`);
}

export async function createExpenseType(
  input: ExpenseTypeInput
): Promise<ExpenseType> {
  await delay();
  return insertExpenseType({
    id: newId("etype"),
    displayName: input.displayName,
    accountingCode: input.accountingCode,
    isMileage: input.isMileage,
  });
}

export async function updateExpenseType(
  id: string,
  patch: Partial<ExpenseType>
): Promise<ExpenseType> {
  await delay();
  const type = patchExpenseType(id, patch);
  if (!type) throw new Error(`Expense type ${id} not found`);
  return type;
}

// ---- Mock email outbox ----

export async function getOutbox(): Promise<MockEmail[]> {
  await delay();
  return [...listOutbox()].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

// Re-export approval history type consumers may want alongside the layer.
export type { ApprovalHistory };
