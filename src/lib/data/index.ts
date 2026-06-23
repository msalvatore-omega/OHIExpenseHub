// MOCK LAYER — replace bodies with Prisma/fetch for production; keep signatures identical.
//
// This is THE SWAP BOUNDARY. The UI only ever imports from here. Every function
// is async, mirrors a future API/DB call, and simulates network latency so the
// loading states behave like production. When real services arrive, swap the
// bodies (Prisma queries, REST/GraphQL fetches) and leave the signatures alone.

import {
  canAccessGallery,
  clearWorkflowHistory,
  findReceipt,
  findReport,
  getSetting,
  getSettingValue,
  insertApprovalGroupMember,
  insertApprovalHistory,
  patchApprovalHistory,
  insertChangeLog,
  listApprovalGroupMembers,
  listApprovalGroups,
  removeApprovalGroupMember,
  insertEmail,
  insertReceipt,
  insertReport,
  listApprovalHistory,
  listChangeLogs,
  listDelegates,
  listExpenseTypes,
  listLineItems,
  patchLineItem,
  listOutbox,
  listReceipts,
  listReports,
  listUsers,
  newId,
  nowIso,
  insertDelegate,
  insertExpenseType,
  insertUser,
  patchExpenseType,
  patchReceipt,
  patchReport,
  patchUser,
  recalcReportTotal,
  removeDelegate,
  removeExpenseType,
  removeReport,
  removeUser,
  replaceLineItemsForReport,
  listUserActivities,
  pruneUserActivities,
  removeReceiptById,
  upsertSetting,
  userHasRelations,
} from "@/lib/data/store";
import {
  DEFAULT_APP_VERSION,
  DEFAULT_RECEIPT_TRASH_RETENTION_DAYS,
  MILEAGE_RATE,
  SETTING_KEYS,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type {
  AccountingReportRow,
  ActivityAnalyticsResult,
  ActivityFilter,
  AnalyticsFilter,
  AppSettings,
  ApprovalActionResult,
  ApprovalChainInfoResult,
  ApprovalChainStepDisplay,
  ApprovalGroupKey,
  ApprovalGroupWithMembers,
  ApprovalHistory,
  CreateDraftInput,
  CreateReceiptInput,
  CreateUserInput,
  Delegate,
  DelegateInput,
  DeleteReportResult,
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
  ReportChangeLog,
  ReportChangeLogRow,
  ReportChangeType,
  ReportDetail,
  ReportFilter,
  ReportRoutingRow,
  ReportStatus,
  User,
} from "@/lib/types";

/**
 * Authorization failure. In the eventual API this maps to an HTTP 403; here the
 * mock "server" throws it so the UI can surface a forbidden state.
 */
export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * State-conflict failure (maps to HTTP 409) — e.g. attempting an action that the
 * report's current status doesn't allow, like deleting a non-draft report.
 */
export class ConflictError extends Error {
  readonly status = 409;
  constructor(message = "Conflict") {
    super(message);
    this.name = "ConflictError";
  }
}

/** No-op kept so call-sites compile without changes; resolved immediately. */
function delay(_min = 0, _max = 0): Promise<void> {
  return Promise.resolve();
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

/**
 * The person whose expenses a report represents — the payee. Approval routing
 * follows this person's chain, not the (possibly delegate) submitter's.
 */
function payeeId(report: ExpenseReport): string {
  return report.onBehalfOfId ?? report.submitterId;
}

/**
 * A single step in a report's approval chain: either one user (an approver or
 * the fallback) or a whole approval group (Accounting / Executive).
 */
type ChainStep =
  | { kind: "user"; userId: string }
  | { kind: "group"; groupId: string; groupKey: ApprovalGroupKey; name: string };

/**
 * Whether a report fast-tracks: the payee has a threshold > 0 and the report
 * total is below it. Fast-tracked reports skip Approvers #2/#3.
 */
function isFastTracked(report: ExpenseReport): boolean {
  const payee = userById(payeeId(report));
  const threshold = payee?.fastTrackThreshold ?? 0;
  return threshold > 0 && report.totalAmount < threshold;
}

function groupStep(key: ApprovalGroupKey): ChainStep | undefined {
  const g = listApprovalGroups().find((x) => x.key === key);
  return g ? { kind: "group", groupId: g.id, groupKey: key, name: g.name } : undefined;
}

/** Active member ids of a group (membership active AND the user active). */
function activeGroupMemberIds(groupId: string): string[] {
  return listApprovalGroupMembers()
    .filter((m) => m.groupId === groupId && m.isActive)
    .map((m) => m.userId)
    .filter((uid) => userById(uid)?.isActive);
}

/**
 * Build a report's approval chain at the current data state. The user step(s)
 * come from the payee's approver chain (fast-track keeps only Approver #1), with
 * a fallback to manager → first ADMIN, followed ALWAYS by the Accounting then
 * Executive groups.
 */
function buildChain(report: ExpenseReport): ChainStep[] {
  const payee = userById(payeeId(report));
  let userIds: string[];
  if (isFastTracked(report)) {
    userIds = payee?.approver1Id ? [payee.approver1Id] : [];
  } else {
    userIds = [payee?.approver1Id, payee?.approver2Id, payee?.approver3Id].filter(
      (id): id is string => Boolean(id)
    );
  }
  if (userIds.length === 0) {
    const fb =
      userById(payee?.managerId ?? undefined) ??
      listUsers().find((u) => u.role === "ADMIN");
    if (fb) userIds = [fb.id];
  }
  const steps: ChainStep[] = userIds.map((id) => ({ kind: "user", userId: id }));
  const acct = groupStep("ACCOUNTING");
  const exec = groupStep("EXECUTIVE");
  if (acct) steps.push(acct);
  if (exec) steps.push(exec);
  return steps;
}

/** Number of completed (approved) steps — also the index of the current step. */
function approvalCount(report: ExpenseReport): number {
  return listApprovalHistory(report.id).filter((h) => h.action === "APPROVED")
    .length;
}

/** The step a report is currently waiting on (only meaningful while open). */
function currentStep(report: ExpenseReport): ChainStep | undefined {
  const chain = buildChain(report);
  return chain[approvalCount(report)];
}

/** Display label for a step: "Approver N" or the group's name. */
function stepLabelOf(step: ChainStep, chain: ChainStep[]): string {
  if (step.kind === "group") return step.name;
  // Ordinal among user steps, matched by value (chain may be rebuilt).
  const userSteps = chain.filter(
    (s): s is Extract<ChainStep, { kind: "user" }> => s.kind === "user"
  );
  const n = userSteps.findIndex((s) => s.userId === step.userId);
  return `Approver ${(n < 0 ? 0 : n) + 1}`;
}

/** Users who can act on a step right now (the user, or a group's active members). */
function stepTargetIds(step: ChainStep): string[] {
  return step.kind === "user" ? [step.userId] : activeGroupMemberIds(step.groupId);
}

/** Whether the report is currently awaiting action from this user. */
function isPendingFor(report: ExpenseReport, userId: string): boolean {
  if (!OPEN_STATUSES.includes(report.status)) return false;
  const step = currentStep(report);
  return step ? stepTargetIds(step).includes(userId) : false;
}

/** The most recent user who acted on the report (for finished-report display). */
function lastActorId(report: ExpenseReport): string | undefined {
  return [...listApprovalHistory(report.id)]
    .reverse()
    .find((h) => (h.action === "APPROVED" || h.action === "REJECTED") && h.approverId)
    ?.approverId;
}

/** Who/what the report is currently with, as a display name. */
function pendingTargetName(report: ExpenseReport): string {
  const step = currentStep(report);
  if (!step) return userName(lastActorId(report));
  return step.kind === "group" ? step.name : userName(step.userId);
}

/** Current step label for routing/dashboard, e.g. "Approver 1" / "Accounting Approval". */
function routingStepLabel(report: ExpenseReport): string {
  const chain = buildChain(report);
  const step = chain[approvalCount(report)];
  return step ? stepLabelOf(step, chain) : "—";
}

/** Insert the PENDING history entry for a step (display + timeline). */
function insertPendingStep(
  reportId: string,
  step: ChainStep,
  timestamp: string
): void {
  insertApprovalHistory({
    id: newId("history"),
    reportId,
    approverId: step.kind === "user" ? step.userId : "",
    approvalGroupId: step.kind === "group" ? step.groupId : undefined,
    action: "PENDING",
    createdAt: timestamp,
  });
}

/** Email everyone who can act on a step that just became pending. */
function notifyStep(report: ExpenseReport, step: ChainStep): MockEmail[] {
  const submitter = userById(report.submitterId);
  const who =
    step.kind === "group" ? `${step.name} review` : "your approval";
  const subject = `Action Required: ${report.reportName} needs ${who}`;
  const body = `${submitter?.name ?? "A submitter"} submitted an expense report (${report.reportName}) totaling ${currency(report.totalAmount)} for ${who}.`;
  const out: MockEmail[] = [];
  for (const uid of stepTargetIds(step)) {
    const u = userById(uid);
    if (u) out.push(sendMockEmail(u.email, subject, body));
  }
  return out;
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
    approverName: pendingTargetName(report),
    step: routingStepLabel(report),
    fastTracked: isFastTracked(report),
  };
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In Review",
  ACCOUNTING_REVIEW: "Accounting Review",
  EXECUTIVE_REVIEW: "Executive Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAID: "Paid",
};

/** Header fields whose post-submission edits are audited, with display labels. */
const AUDITED_FIELD_LABEL: Partial<Record<keyof ExpenseReport, string>> = {
  reportName: "Report name",
  paidToId: "Paid to",
  onBehalfOfId: "On behalf of",
  periodFrom: "Period start",
  periodTo: "Period end",
};

/** A report is audited (every change logged) once it has been submitted. */
function isAudited(report: ExpenseReport): boolean {
  return Boolean(report.submittedAt) || report.status !== "DRAFT";
}

/** Append one entry to the report's change log (the audit trail). */
function recordChange(
  reportId: string,
  changedById: string,
  changeType: ReportChangeType,
  summary: string,
  extra?: { field?: string; oldValue?: string; newValue?: string; note?: string }
): ReportChangeLog {
  return insertChangeLog({
    id: newId("change"),
    reportId,
    changedById,
    changedAt: nowIso(),
    changeType,
    field: extra?.field,
    oldValue: extra?.oldValue,
    newValue: extra?.newValue,
    summary,
    note: extra?.note,
  });
}

const OPEN_STATUSES: ReportStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "ACCOUNTING_REVIEW",
  "EXECUTIVE_REVIEW",
];
const ACTIVE_STATUSES: ReportStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "ACCOUNTING_REVIEW",
  "EXECUTIVE_REVIEW",
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

/** Fallback actor for audited actions taken outside an explicit session. */
function accountingUserId(): string {
  return listUsers().find((u) => u.role === "ACCOUNTING")?.id ?? "system";
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
    pendingApprovalCount: reports.filter((r) =>
      OPEN_STATUSES.includes(r.status)
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

/** The audit trail for a single report, newest first. */
export async function getReportChangeLogs(
  reportId: string
): Promise<ReportChangeLog[]> {
  await delay();
  return [...listChangeLogs(reportId)].sort((a, b) =>
    b.changedAt.localeCompare(a.changedAt)
  );
}

/** All change-log entries across reports, enriched for the global Change Log. */
export async function getReportChanges(): Promise<ReportChangeLogRow[]> {
  await delay();
  const reportById = new Map(listReports().map((r) => [r.id, r]));
  return [...listChangeLogs()]
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    .map((change) => {
      const report = change.reportId ? reportById.get(change.reportId) : undefined;
      return {
        change,
        reportName: report?.reportName ?? "—",
        changedByName: userName(change.changedById),
        submitterId: report?.submitterId ?? "",
        paidToId: report?.paidToId ?? "",
        periodFrom: report?.periodFrom ?? "",
        periodTo: report?.periodTo ?? "",
      };
    });
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
  patch: Partial<ExpenseReport>,
  actorId?: string
): Promise<ExpenseReport> {
  await delay();
  const before = findReport(id);
  if (!before) throw new Error(`Report ${id} not found`);
  const audited = isAudited(before);
  const snapshot = { ...before };

  const updated = patchReport(id, patch);
  if (!updated) throw new Error(`Report ${id} not found`);

  if (audited) {
    const who = actorId ?? before.submitterId;
    for (const key of Object.keys(patch) as (keyof ExpenseReport)[]) {
      if (key === "updatedAt") continue;
      const oldV = snapshot[key];
      const newV = updated[key];
      if (oldV === newV) continue;

      if (key === "status") {
        recordChange(
          id,
          who,
          "STATUS",
          `Status changed from ${STATUS_LABEL[oldV as ReportStatus]} to ${STATUS_LABEL[newV as ReportStatus]}`,
          { field: "status", oldValue: String(oldV), newValue: String(newV) }
        );
      } else if (key === "totalAmount") {
        recordChange(
          id,
          who,
          "AMOUNT",
          `Total changed from ${currency(Number(oldV))} to ${currency(Number(newV))}`,
          { field: "totalAmount", oldValue: String(oldV), newValue: String(newV) }
        );
      } else if (key in AUDITED_FIELD_LABEL) {
        const label = AUDITED_FIELD_LABEL[key]!;
        const fmt = (v: unknown) =>
          key === "paidToId" || key === "onBehalfOfId"
            ? userName(v as string)
            : String(v ?? "—");
        recordChange(id, who, "FIELD", `${label} changed from "${fmt(oldV)}" to "${fmt(newV)}"`, {
          field: String(key),
          oldValue: fmt(oldV),
          newValue: fmt(newV),
        });
      }
    }
  }
  return updated;
}

/**
 * Delete a DRAFT report, first returning any attached receipts to the gallery.
 *
 * Mirrors `DELETE /api/reports/[id]`: only the submitter or an ADMIN may delete,
 * and only while the report is DRAFT (403 / 409 otherwise). Receipts referenced
 * by the report's line items are detached (isAttached = false) so they reappear
 * in the gallery's Unattached list — the Receipt rows and images are NOT deleted.
 * The report and its line items / approval history / change log then cascade away.
 */
export async function deleteReport(
  id: string,
  actorId: string
): Promise<DeleteReportResult> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  // Authorize: submitter or ADMIN only, and only while DRAFT.
  const actor = userById(actorId);
  const canDelete = report.submitterId === actorId || actor?.role === "ADMIN";
  if (!canDelete) {
    throw new ForbiddenError("You do not have permission to delete this report.");
  }
  if (report.status !== "DRAFT") {
    throw new ConflictError("Only draft reports can be deleted.");
  }

  // Detach receipts (return them to the gallery) before removing the report.
  const returned = new Set<string>();
  for (const li of listLineItems(id)) {
    if (!li.receiptId || returned.has(li.receiptId)) continue;
    const receipt = findReceipt(li.receiptId);
    if (receipt?.isAttached) {
      patchReceipt(li.receiptId, { isAttached: false });
      returned.add(li.receiptId);
    }
  }

  const ok = removeReport(id);
  if (!ok) throw new Error(`Report ${id} not found`);
  return { receiptsReturned: returned.size };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// 5-minute server-side cache for the mileage rate to avoid reading the DB
// on every line-item save. Stale after the TTL; next save re-reads.
let _mileageRateCache: { rate: number; at: number } | null = null;
const RATE_CACHE_TTL = 5 * 60 * 1000;

function liveMileageRate(): number {
  const now = Date.now();
  if (_mileageRateCache && now - _mileageRateCache.at < RATE_CACHE_TTL) {
    return _mileageRateCache.rate;
  }
  const raw = getSettingValue(SETTING_KEYS.mileageRate);
  const parsed = raw ? parseFloat(raw) : NaN;
  const rate = isFinite(parsed) && parsed > 0 ? parsed : MILEAGE_RATE;
  _mileageRateCache = { rate, at: now };
  return rate;
}

/**
 * Replace a report's line items wholesale, normalizing mileage rows
 * (amount = miles * rate) and recomputing the report total.
 */
export async function replaceLineItems(
  reportId: string,
  items: LineItemInput[],
  actorId?: string
): Promise<ExpenseLineItem[]> {
  await delay();
  const report = findReport(reportId);
  if (!report) throw new Error(`Report ${reportId} not found`);

  const audited = isAudited(report);
  const before = audited ? [...listLineItems(reportId)] : [];
  const prevTotal = report.totalAmount;

  const allTypes = listExpenseTypes();
  const mileageTypeIds = new Set(allTypes.filter((t) => t.isMileage).map((t) => t.id));
  const otherTypeId = allTypes.find((t) => !t.isMileage && t.displayName === "Other")?.id;

  const normalized: ExpenseLineItem[] = items.map((it) => {
    const isMileage = mileageTypeIds.has(it.expenseTypeId);
    const miles = isMileage ? it.miles : undefined;
    const calculatedAmount =
      isMileage && miles != null ? round2(miles * liveMileageRate()) : undefined;
    const amount = isMileage ? calculatedAmount ?? 0 : it.amount ?? 0;
    const isOther = it.expenseTypeId === otherTypeId;
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
      otherDescription: isOther ? it.otherDescription : undefined,
    };
  });

  replaceLineItemsForReport(reportId, normalized);
  const newTotal = recalcReportTotal(reportId);

  if (audited) {
    const who = actorId ?? report.submitterId;
    const beforeById = new Map(before.map((li) => [li.id, li]));
    const afterById = new Map(normalized.map((li) => [li.id, li]));

    for (const li of normalized) {
      if (beforeById.has(li.id)) continue;
      recordChange(
        reportId,
        who,
        "LINE_ITEM",
        `Line item added: ${li.description || "—"} (${currency(li.amount)})`,
        { field: "lineItem", newValue: li.description }
      );
    }
    for (const li of before) {
      if (afterById.has(li.id)) continue;
      recordChange(
        reportId,
        who,
        "LINE_ITEM",
        `Line item removed: ${li.description || "—"} (${currency(li.amount)})`,
        { field: "lineItem", oldValue: li.description }
      );
    }
    for (const li of normalized) {
      const old = beforeById.get(li.id);
      if (!old) continue;
      if (
        old.amount !== li.amount ||
        old.description !== li.description ||
        old.expenseTypeId !== li.expenseTypeId ||
        old.expenseDate !== li.expenseDate
      ) {
        recordChange(
          reportId,
          who,
          "LINE_ITEM",
          `Line item edited: ${li.description || old.description || "—"}`,
          {
            field: "lineItem",
            oldValue: currency(old.amount),
            newValue: currency(li.amount),
          }
        );
      }
    }
    if (newTotal !== prevTotal) {
      recordChange(
        reportId,
        who,
        "AMOUNT",
        `Total changed from ${currency(prevTotal)} to ${currency(newTotal)}`,
        { field: "totalAmount", oldValue: String(prevTotal), newValue: String(newTotal) }
      );
    }
  }
  return normalized;
}

/**
 * Reclassify a single line item's expense type in-place.
 * Only ACCOUNTING and ADMIN roles may call this. Status does not change.
 */
export async function reclassifyLineItemExpenseType(
  reportId: string,
  lineItemId: string,
  newTypeId: string,
  reason: string,
  actorId: string
): Promise<ExpenseLineItem> {
  await delay();
  const actor = userById(actorId);
  if (actor?.role !== "ACCOUNTING" && actor?.role !== "ADMIN") {
    throw new ForbiddenError("Only Accounting or Admin may reclassify expense types.");
  }

  const report = findReport(reportId);
  if (!report) throw new Error(`Report ${reportId} not found`);

  const lineItem = listLineItems(reportId).find((li) => li.id === lineItemId);
  if (!lineItem) throw new Error(`Line item ${lineItemId} not found`);

  const allTypes = listExpenseTypes();
  const oldType = allTypes.find((t) => t.id === lineItem.expenseTypeId);
  const newType = allTypes.find((t) => t.id === newTypeId);
  if (!newType) throw new Error(`Expense type ${newTypeId} not found`);

  const otherTypeId = allTypes.find((t) => !t.isMileage && t.displayName === "Other")?.id;

  const patch: Partial<ExpenseLineItem> = {
    expenseTypeId: newTypeId,
    reclassifiedAt: nowIso(),
    reclassifiedById: actorId,
  };
  if (newTypeId !== otherTypeId) {
    patch.otherDescription = undefined;
  }

  const updated = patchLineItem(lineItemId, patch);
  if (!updated) throw new Error(`Failed to patch line item ${lineItemId}`);

  const oldName = oldType?.displayName ?? lineItem.expenseTypeId;
  const newName = newType.displayName;

  recordChange(reportId, actorId, "FIELD", "Expense type reclassified by accounting", {
    field: "expenseTypeId",
    oldValue: oldName,
    newValue: newName,
    note: reason || undefined,
  });

  const submitterId = report.onBehalfOfId ?? report.submitterId;
  const submitter = userById(submitterId);
  if (submitter?.email) {
    const lineIdx = listLineItems(reportId).findIndex((li) => li.id === lineItemId);
    const lineLabel = lineIdx >= 0 ? `Line ${lineIdx + 1}` : "A line item";
    sendMockEmail(
      submitter.email,
      `Expense type updated on your report "${report.reportName}"`,
      [
        `${lineLabel} was reclassified from "${oldName}" to "${newName}" by accounting.`,
        reason ? `Reason: ${reason}` : "",
        `View report: /reports/${reportId}/view`,
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  }

  return updated;
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

  // Build the chain (fast-track or full) and route to its first step.
  const notifications: MockEmail[] = [];
  const chain = buildChain(updated);
  const first = chain[0];
  if (first) {
    insertPendingStep(id, first, timestamp);
    notifications.push(...notifyStep(updated, first));
  }
  return { report: updated, notifications };
}

export async function approveReport(
  id: string,
  actorId: string,
  comment?: string
): Promise<ApprovalActionResult> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  const timestamp = nowIso();
  const chain = buildChain(report);
  const idx = approvalCount(report);
  const step = chain[idx];
  const actorName = userName(actorId);
  const prevStatus = report.status;
  const notifications: MockEmail[] = [];

  // Record this user's approval at the current step (group id if a group step).
  insertApprovalHistory({
    id: newId("history"),
    reportId: id,
    approverId: actorId,
    approvalGroupId: step?.kind === "group" ? step.groupId : undefined,
    action: "APPROVED",
    comment,
    createdAt: timestamp,
  });

  const nextStep = chain[idx + 1];
  const stepLabel = step ? stepLabelOf(step, chain) : "Approval";

  if (nextStep) {
    // Advance to the next step; status reflects what's now waiting on it.
    const nextStatus: ReportStatus =
      nextStep.kind === "group"
        ? nextStep.groupKey === "ACCOUNTING"
          ? "ACCOUNTING_REVIEW"
          : "EXECUTIVE_REVIEW"
        : "IN_REVIEW";
    const updated = patchReport(id, { status: nextStatus })!;
    recordChange(id, actorId, "STATUS", `${stepLabel} approved by ${actorName}`, {
      field: "status",
      oldValue: prevStatus,
      newValue: nextStatus,
      note: comment,
    });
    insertPendingStep(id, nextStep, timestamp);
    notifications.push(...notifyStep(updated, nextStep));
    return { report: updated, notifications };
  }

  // Last step (Executive Approval) — finalize and hand off to accounting.
  const updated = patchReport(id, { status: "APPROVED" })!;
  recordChange(
    id,
    actorId,
    "STATUS",
    `${stepLabel} approved by ${actorName} — report approved`,
    { field: "status", oldValue: prevStatus, newValue: "APPROVED", note: comment }
  );

  const submitter = userById(report.submitterId);
  if (submitter) {
    notifications.push(
      sendMockEmail(
        submitter.email,
        `Approved: ${report.reportName}`,
        `Your expense report (${report.reportName}) totaling ${currency(updated.totalAmount)} was fully approved${comment ? `. Note: ${comment}` : "."}`
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

/**
 * Reject a report and return it to DRAFT for revision. A reason is required.
 * The REJECTED ApprovalHistory entry is preserved so the employee can see
 * every rejection note; PENDING and APPROVED workflow entries are cleared so
 * resubmission restarts the chain from Approver #1.
 */
export async function rejectReport(
  id: string,
  actorId: string,
  comment: string
): Promise<ApprovalActionResult> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  const trimmedComment = comment.trim();
  if (!trimmedComment) throw new Error("A reason is required to reject a report.");

  const timestamp = nowIso();
  const chain = buildChain(report);
  const step = chain[approvalCount(report)];
  const actorName = userName(actorId);
  const stepLabel = step ? stepLabelOf(step, chain) : "Approval";
  const prevStatus = report.status;

  // Insert the REJECTED record before clearing so it is not lost.
  insertApprovalHistory({
    id: newId("history"),
    reportId: id,
    approverId: actorId,
    approvalGroupId: step?.kind === "group" ? step.groupId : undefined,
    action: "REJECTED",
    comment: trimmedComment,
    createdAt: timestamp,
  });

  // Clear only PENDING and APPROVED entries so the REJECTED history accumulates
  // across resubmission cycles and approvalCount resets to 0 on next submit.
  clearWorkflowHistory(id);

  const updated = patchReport(id, { status: "DRAFT" })!;
  recordChange(
    id,
    actorId,
    "STATUS",
    `Rejected by ${actorName} at ${stepLabel} — returned to employee`,
    { field: "status", oldValue: prevStatus, newValue: "DRAFT", note: trimmedComment }
  );

  const notifications: MockEmail[] = [];
  const submitter = userById(report.submitterId);
  if (submitter) {
    notifications.push(
      sendMockEmail(
        submitter.email,
        `Changes Required: ${report.reportName}`,
        `Your expense report (${report.reportName}) was rejected by ${actorName} at ${stepLabel} and has been returned to your drafts for revision.\n\nReason: ${trimmedComment}\n\nEdit it here: /reports/${id}/edit`
      )
    );
  }
  return { report: updated, notifications };
}

/**
 * Returns the IDs of DRAFT reports (belonging to userId) that have at least
 * one REJECTED ApprovalHistory entry. Used to flag rejected-and-returned
 * drafts on the dashboard without fetching full history per report.
 */
export async function getDraftRejectionIds(userId: string): Promise<string[]> {
  await delay(50, 150);
  const myDraftIds = new Set(
    listReports()
      .filter((r) => r.status === "DRAFT" && involvesUser(r, userId))
      .map((r) => r.id)
  );
  const out = new Set<string>();
  for (const h of listApprovalHistory()) {
    if (h.action === "REJECTED" && myDraftIds.has(h.reportId)) {
      out.add(h.reportId);
    }
  }
  return [...out];
}

export async function markPaid(
  id: string,
  actorId?: string
): Promise<ApprovalActionResult> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  const prevStatus = report.status;
  const updated = patchReport(id, { status: "PAID" })!;
  if (prevStatus !== "PAID") {
    recordChange(
      id,
      actorId ?? accountingUserId(),
      "STATUS",
      "Marked as paid",
      { field: "status", oldValue: prevStatus, newValue: "PAID" }
    );
  }

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

/**
 * Accounting/admin override of a report's status. Logs a STATUS change and, when
 * set to PAID, queues the same payment notice Mark-as-Paid sends.
 */
export async function changeReportStatus(
  id: string,
  status: ReportStatus,
  changedById: string
): Promise<ApprovalActionResult> {
  await delay();
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  const prevStatus = report.status;
  if (prevStatus === status) return { report, notifications: [] };

  const updated = patchReport(id, { status })!;
  recordChange(
    id,
    changedById,
    "STATUS",
    `Status changed from ${STATUS_LABEL[prevStatus]} to ${STATUS_LABEL[status]}`,
    { field: "status", oldValue: prevStatus, newValue: status }
  );

  const notifications: MockEmail[] = [];
  if (status === "PAID") {
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
  }
  return { report: updated, notifications };
}

/**
 * Auto-save a draft note to the PENDING history entry for the current step.
 * Returns `{ resolved: true }` when the step no longer awaits this actor
 * (e.g. a concurrent group member just approved) — the caller should show a
 * "step resolved" toast and refresh the report.
 */
export async function savePendingNote(
  reportId: string,
  actorId: string,
  comment: string
): Promise<{ resolved: boolean }> {
  // No simulated delay — auto-save should feel instant.
  const report = findReport(reportId);
  if (!report || !isPendingFor(report, actorId)) return { resolved: true };

  // Walk backwards through sorted history: the first entry we hit should be
  // the current step's PENDING row (most recently inserted).
  const history = [...listApprovalHistory(reportId)].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt)
  );
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].action === "PENDING") {
      patchApprovalHistory(history[i].id, { comment: comment || undefined });
      return { resolved: false };
    }
    // Most-recent entry is APPROVED/REJECTED — step resolved concurrently.
    break;
  }
  return { resolved: false };
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
    .filter((r) => isPendingFor(r, approverId))
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
        (involvesUser(r, userId) ||
          isPendingFor(r, userId) ||
          listApprovalHistory(r.id).some((h) => h.approverId === userId))
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toRoutingRow);
}

// ---- Receipts ----

export async function getReceipts(
  filter?: ReceiptFilter,
  requesterId?: string
): Promise<Receipt[]> {
  await delay();
  // Authorize reading another owner's gallery (server-side check).
  if (requesterId && filter?.userId && !canAccessGallery(requesterId, filter.userId)) {
    throw new ForbiddenError("You do not have access to this gallery.");
  }
  let receipts = [...listReceipts()];
  if (filter?.userId)
    receipts = receipts.filter((r) => r.userId === filter.userId);
  if (filter?.isAttached !== undefined)
    receipts = receipts.filter((r) => r.isAttached === filter.isAttached);
  // Default: only live receipts. Pass trashed:true to get the trash bin.
  if (filter?.trashed) {
    receipts = receipts.filter((r) => r.deletedAt != null);
  } else {
    receipts = receipts.filter((r) => r.deletedAt == null);
  }
  return receipts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Soft-delete receipts (move to trash). Rejects attached receipts. */
export async function trashReceipts(
  ids: string[],
  deletedById: string
): Promise<void> {
  await delay();
  const ts = nowIso();
  for (const id of ids) {
    const r = findReceipt(id);
    if (!r) continue;
    if (r.isAttached) throw new ConflictError("Cannot trash an attached receipt — detach from the report first.");
    patchReceipt(id, { deletedAt: ts, deletedById });
  }
}

/** Restore soft-deleted receipts back to the live gallery. */
export async function restoreReceipts(ids: string[]): Promise<void> {
  await delay();
  for (const id of ids) {
    patchReceipt(id, { deletedAt: null, deletedById: null });
  }
}

/** Permanently delete receipts (removes the row; no real blob in prototype). */
export async function hardDeleteReceipts(ids: string[]): Promise<void> {
  await delay();
  for (const id of ids) {
    removeReceiptById(id);
  }
}

/** Auto-purge receipts whose trash retention window has elapsed. */
export async function purgeExpiredTrash(): Promise<number> {
  await delay();
  const retentionDays =
    parseInt(getSettingValue(SETTING_KEYS.receiptTrashRetentionDays) ?? "30", 10) || 30;
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const toDelete = listReceipts()
    .filter((r) => r.deletedAt != null && r.deletedAt < cutoff && !r.isAttached)
    .map((r) => r.id);
  for (const id of toDelete) removeReceiptById(id);
  return toDelete.length;
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
  const uploadedById = input.uploadedById ?? input.userId;
  // Authorize uploading into the target gallery (server-side check).
  if (!canAccessGallery(uploadedById, input.userId)) {
    throw new ForbiddenError("You do not have access to this gallery.");
  }
  return insertReceipt({
    id: newId("receipt"),
    userId: input.userId,
    uploadedById,
    source: input.source ?? "UPLOAD",
    imageUrl: input.imageUrl,
    merchantName: input.merchantName,
    merchantDate: input.merchantDate,
    totalAmount: input.totalAmount,
    taxAmount: input.taxAmount,
    rawOcrData: input.rawOcrData,
    isAttached: false,
    deletedAt: null,
    deletedById: null,
    createdAt: nowIso(),
  });
}

/**
 * Look up an ACTIVE user by email (case-insensitive). Used by the email-ingest
 * endpoint to decide whether an inbound receipt maps to a known employee.
 */
export async function findActiveUserByEmail(
  email: string
): Promise<User | undefined> {
  await delay();
  const needle = email.trim().toLowerCase();
  return listUsers().find(
    (u) => u.isActive && u.email.toLowerCase() === needle
  );
}

/**
 * Persist a receipt that arrived by email. System-owned: there is no app user
 * who "uploaded" it (uploadedById = null) and the source is EMAIL. Starts
 * unattached, so it appears in the owner's gallery like any other capture.
 * No gallery-access check — the caller (ingest endpoint) is trusted M2M.
 */
export async function createEmailReceipt(input: {
  userId: string;
  imageUrl: string;
  merchantName?: string;
  merchantDate?: string;
  totalAmount?: number;
  taxAmount?: number;
  rawOcrData?: unknown;
}): Promise<Receipt> {
  await delay();
  return insertReceipt({
    id: newId("receipt"),
    userId: input.userId,
    uploadedById: null,
    source: "EMAIL",
    imageUrl: input.imageUrl,
    merchantName: input.merchantName,
    merchantDate: input.merchantDate,
    totalAmount: input.totalAmount,
    taxAmount: input.taxAmount,
    rawOcrData: input.rawOcrData,
    isAttached: false,
    deletedAt: null,
    deletedById: null,
    createdAt: nowIso(),
  });
}

/**
 * Build a draft report from selected gallery receipts. Enforces gallery access;
 * when the owner isn't the requester, the report is created on the owner's
 * behalf (onBehalfOfId + paidToId = owner, submitter = requester).
 */
export async function createReportFromReceipts(input: {
  requesterId: string;
  ownerId: string;
  receiptIds: string[];
}): Promise<string> {
  if (!canAccessGallery(input.requesterId, input.ownerId)) {
    throw new ForbiddenError("You do not have access to this gallery.");
  }
  const chosen = listReceipts().filter(
    (r) => input.receiptIds.includes(r.id) && r.userId === input.ownerId
  );
  if (chosen.length === 0) throw new Error("No receipts selected.");

  const types = listExpenseTypes();
  const other =
    types.find((t) => t.displayName === "Other Expenses") ??
    types.find((t) => !t.isMileage);
  const today = nowIso().slice(0, 10);
  const dates = chosen
    .map((r) => r.merchantDate)
    .filter((d): d is string => Boolean(d))
    .sort();
  const onBehalfOfId =
    input.ownerId !== input.requesterId ? input.ownerId : undefined;

  const draft = await createDraft({
    reportName: `Receipts — ${formatDate(today)}`,
    submitterId: input.requesterId,
    onBehalfOfId,
    paidToId: input.ownerId,
    periodFrom: dates[0] ?? today,
    periodTo: dates[dates.length - 1] ?? today,
  });

  const items: LineItemInput[] = chosen.map((r) => ({
    expenseDate: r.merchantDate ?? today,
    purposeOfTrip: "",
    description: r.merchantName ?? "Receipt",
    city: "",
    state: "",
    country: "",
    expenseTypeId: other?.id ?? "",
    amount: r.totalAmount ?? 0,
    receiptId: r.id,
  }));
  await replaceLineItems(draft.id, items);
  await Promise.all(chosen.map((r) => attachReceipt(draft.id, r.id)));
  return draft.id;
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
  // Exclude deactivated principals from the people picker.
  return listUsers().filter((u) => principalIds.has(u.id) && u.isActive);
}

export async function getExpenseTypes(): Promise<ExpenseType[]> {
  await delay();
  return [...listExpenseTypes()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
  );
}

export async function getActiveExpenseTypes(): Promise<ExpenseType[]> {
  await delay();
  return [...listExpenseTypes()]
    .filter((t) => t.isActive)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
}

export async function getExpenseTypeUsageCounts(): Promise<Record<string, number>> {
  await delay();
  const counts: Record<string, number> = {};
  for (const li of listLineItems()) {
    counts[li.expenseTypeId] = (counts[li.expenseTypeId] ?? 0) + 1;
  }
  return counts;
}

// ---- System settings ----

/** Resolve the known system settings into a typed view (with fallbacks). */
export async function getSystemSettings(): Promise<AppSettings> {
  await delay();
  const rateRow = getSetting(SETTING_KEYS.mileageRate);
  const parsedRate = rateRow ? parseFloat(rateRow.value) : NaN;
  const parsedTrash = parseInt(
    getSettingValue(SETTING_KEYS.receiptTrashRetentionDays) ?? "30",
    10
  );
  return {
    appVersion: getSettingValue(SETTING_KEYS.appVersion) ?? DEFAULT_APP_VERSION,
    announcementMessage: getSettingValue(SETTING_KEYS.announcement) ?? "",
    mileageRate: isFinite(parsedRate) && parsedRate > 0 ? parsedRate : MILEAGE_RATE,
    mileageRateUpdatedAt: rateRow?.updatedAt ?? null,
    receiptTrashRetentionDays: isFinite(parsedTrash) && parsedTrash > 0 ? parsedTrash : DEFAULT_RECEIPT_TRASH_RETENTION_DAYS,
  };
}

/** Update a single system setting by key (admin-only in the UI). */
export async function updateSystemSetting(
  key: string,
  value: string
): Promise<void> {
  await delay();
  upsertSetting(key, value);
  // Bust the mileage-rate cache so the new value is effective immediately.
  if (key === SETTING_KEYS.mileageRate) _mileageRateCache = null;
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
        glCode: type?.glCode ?? "",
        glName: type?.glName ?? "",
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

/**
 * Create a user. azureAdId is left null until the person's first Azure AD login,
 * which matches them by email and fills it in.
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  await delay();
  const email = input.email.trim();
  if (!email) throw new Error("Email is required.");
  if (listUsers().some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("A user with this email already exists.");
  }
  return insertUser({
    id: newId("user"),
    azureAdId: null,
    email,
    name: input.name.trim() || email,
    department: input.department.trim(),
    role: input.role,
    isActive: true,
    managerId: input.managerId || null,
    // Approver chain is configured later via the admin user edit dialog.
    approver1Id: null,
    approver2Id: null,
    approver3Id: null,
    fastTrackThreshold: input.fastTrackThreshold ?? 0,
  });
}

// ---- Approval groups (admin) ----

/** The two mandatory approval groups, each with its members resolved. */
export async function getApprovalGroups(): Promise<ApprovalGroupWithMembers[]> {
  await delay();
  return listApprovalGroups().map((group) => ({
    group,
    members: listApprovalGroupMembers()
      .filter((m) => m.groupId === group.id)
      .map((m) => {
        const u = userById(m.userId);
        return {
          id: m.id,
          userId: m.userId,
          name: u?.name ?? "—",
          isActive: m.isActive && Boolean(u?.isActive),
        };
      }),
  }));
}

/** Add a user to an approval group (no-op if already a member). */
export async function addApprovalGroupMember(
  groupId: string,
  userId: string
): Promise<void> {
  await delay();
  const exists = listApprovalGroupMembers().some(
    (m) => m.groupId === groupId && m.userId === userId
  );
  if (exists) return;
  insertApprovalGroupMember({
    id: newId("agm"),
    groupId,
    userId,
    isActive: true,
    createdAt: nowIso(),
  });
}

/** Remove a membership row from a group. */
export async function removeApprovalGroupMemberById(id: string): Promise<void> {
  await delay();
  if (!removeApprovalGroupMember(id)) {
    throw new Error(`Group member ${id} not found`);
  }
}

/** Whether a user can be hard-deleted (no reports/approvals/delegates/changes). */
export async function getUserDeletability(
  id: string
): Promise<{ canHardDelete: boolean }> {
  await delay();
  return { canHardDelete: !userHasRelations(id) };
}

/** Soft-delete: deactivate a user (they keep their historical records). */
export async function setUserActive(
  id: string,
  isActive: boolean
): Promise<User> {
  await delay();
  const user = patchUser(id, { isActive });
  if (!user) throw new Error(`User ${id} not found`);
  return user;
}

/** Permanently delete a user — only allowed when nothing references them. */
export async function deleteUser(id: string): Promise<void> {
  await delay();
  if (userHasRelations(id)) {
    throw new Error(
      "User has related records and can't be permanently deleted. Deactivate instead."
    );
  }
  if (!removeUser(id)) throw new Error(`User ${id} not found`);
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
  input: ExpenseTypeInput,
  actorId?: string
): Promise<ExpenseType> {
  await delay();
  const duplicate = listExpenseTypes().find(
    (t) => t.displayName.trim().toLowerCase() === input.displayName.trim().toLowerCase()
  );
  if (duplicate) {
    throw new Error(`An expense type named "${duplicate.displayName}" already exists.`);
  }
  if (input.isMileage) {
    const prev = listExpenseTypes().find((t) => t.isMileage);
    if (prev) patchExpenseType(prev.id, { isMileage: false });
  }
  const type = insertExpenseType({
    id: newId("etype"),
    displayName: input.displayName.trim(),
    glCode: input.glCode.trim(),
    glName: input.glName.trim(),
    isMileage: input.isMileage,
    isActive: input.isActive ?? true,
  });
  if (actorId) {
    insertChangeLog({
      id: newId("change"),
      reportId: null,
      changedById: actorId,
      changedAt: nowIso(),
      changeType: "OTHER",
      field: "expenseType",
      summary: `Expense type "${type.displayName}" created`,
      newValue: type.displayName,
    });
  }
  return type;
}

export async function updateExpenseType(
  id: string,
  patch: Partial<ExpenseType>,
  actorId?: string
): Promise<ExpenseType> {
  await delay();
  const current = listExpenseTypes().find((t) => t.id === id);
  if (!current) throw new Error(`Expense type ${id} not found`);
  if (patch.displayName !== undefined) {
    const dup = listExpenseTypes().find(
      (t) => t.id !== id && t.displayName.trim().toLowerCase() === patch.displayName!.trim().toLowerCase()
    );
    if (dup) throw new Error(`An expense type named "${dup.displayName}" already exists.`);
  }
  if (patch.isMileage === true && !current.isMileage) {
    const prev = listExpenseTypes().find((t) => t.isMileage && t.id !== id);
    if (prev) patchExpenseType(prev.id, { isMileage: false });
  }
  const oldName = current.displayName;
  const type = patchExpenseType(id, patch);
  if (!type) throw new Error(`Expense type ${id} not found`);
  if (actorId) {
    const summary =
      patch.displayName && patch.displayName !== oldName
        ? `Expense type renamed from "${oldName}" to "${type.displayName}"`
        : `Expense type "${type.displayName}" updated`;
    insertChangeLog({
      id: newId("change"),
      reportId: null,
      changedById: actorId,
      changedAt: nowIso(),
      changeType: "OTHER",
      field: "expenseType",
      summary,
      oldValue: oldName,
      newValue: type.displayName,
    });
  }
  return type;
}

export async function deleteExpenseType(
  id: string,
  actorId: string
): Promise<void> {
  await delay();
  const type = listExpenseTypes().find((t) => t.id === id);
  if (!type) throw new Error(`Expense type ${id} not found`);
  const count = listLineItems().filter((li) => li.expenseTypeId === id).length;
  if (count > 0) {
    throw new Error(
      `Cannot delete: ${count} line item${count === 1 ? "" : "s"} reference this type. Deactivate it instead.`
    );
  }
  removeExpenseType(id);
  insertChangeLog({
    id: newId("change"),
    reportId: null,
    changedById: actorId,
    changedAt: nowIso(),
    changeType: "OTHER",
    field: "expenseType",
    summary: `Expense type "${type.displayName}" deleted`,
    oldValue: type.displayName,
  });
}

export async function adminChangeReportStatus(
  id: string,
  actorId: string,
  status: ReportStatus,
  reason: string
): Promise<ApprovalActionResult> {
  await delay();
  const actor = userById(actorId);
  if (actor?.role !== "ADMIN") throw new ForbiddenError("Admin access required.");
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);

  const prevStatus = report.status;
  if (prevStatus === status) return { report, notifications: [] };

  const updated = patchReport(id, { status })!;
  recordChange(id, actorId, "STATUS", "Status changed by admin", {
    field: "status",
    oldValue: prevStatus,
    newValue: status,
    note: reason,
  });

  const notifications: MockEmail[] = [];
  const submitter = userById(report.submitterId);
  if (submitter) {
    notifications.push(
      sendMockEmail(
        submitter.email,
        `Report Status Updated: ${report.reportName}`,
        `Your expense report "${report.reportName}" status has been changed to ${STATUS_LABEL[status]} by an administrator.\n\nReason: ${reason}`
      )
    );
  }
  return { report: updated, notifications };
}

export async function adminDeleteReport(
  id: string,
  actorId: string,
  reason?: string
): Promise<{ receiptsReturned: number; notifications: MockEmail[] }> {
  await delay();
  const actor = userById(actorId);
  if (actor?.role !== "ADMIN") throw new ForbiddenError("Admin access required.");
  const report = findReport(id);
  if (!report) throw new Error(`Report ${id} not found`);
  if (report.status !== "DRAFT") throw new ConflictError("Only draft reports can be deleted.");

  const returned = new Set<string>();
  for (const li of listLineItems(id)) {
    if (!li.receiptId || returned.has(li.receiptId)) continue;
    const receipt = findReceipt(li.receiptId);
    if (receipt?.isAttached) {
      patchReceipt(li.receiptId, { isAttached: false });
      returned.add(li.receiptId);
    }
  }

  const reasonText = reason ? `\n\nReason: ${reason}` : "";
  const notifications: MockEmail[] = [];
  const submitter = userById(report.submitterId);
  if (submitter) {
    notifications.push(
      sendMockEmail(
        submitter.email,
        `Draft Deleted: ${report.reportName}`,
        `Your draft expense report "${report.reportName}" has been deleted by an administrator.${reasonText}`
      )
    );
  }
  if (report.paidToId && report.paidToId !== report.submitterId) {
    const payee = userById(report.paidToId);
    if (payee) {
      notifications.push(
        sendMockEmail(
          payee.email,
          `Draft Deleted: ${report.reportName}`,
          `The draft expense report "${report.reportName}" intended for you has been deleted by an administrator.${reasonText}`
        )
      );
    }
  }

  const ok = removeReport(id);
  if (!ok) throw new Error(`Report ${id} not found`);
  return { receiptsReturned: returned.size, notifications };
}

// ---- Mock email outbox ----

export async function getOutbox(): Promise<MockEmail[]> {
  await delay();
  return [...listOutbox()].sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

// ---- Report view: access control + chain display ----

export async function canViewReport(
  reportId: string,
  userId: string
): Promise<boolean> {
  await delay(50, 150);
  const report = findReport(reportId);
  if (!report) return false;
  const user = userById(userId);
  if (!user) return false;
  if (user.role === "ACCOUNTING" || user.role === "ADMIN") return true;
  if (involvesUser(report, userId)) return true;
  const history = listApprovalHistory(reportId);
  if (history.some((h) => h.approverId === userId)) return true;
  const groupIds = new Set(
    history.filter((h) => h.approvalGroupId).map((h) => h.approvalGroupId!)
  );
  if (groupIds.size > 0) {
    const isMember = listApprovalGroupMembers().some(
      (m) => groupIds.has(m.groupId) && m.userId === userId && m.isActive
    );
    if (isMember) return true;
  }
  return false;
}

export async function getApprovalChainInfo(
  reportId: string
): Promise<ApprovalChainInfoResult | null> {
  await delay();
  const report = findReport(reportId);
  if (!report) return null;

  const chain = buildChain(report);
  const history = [...listApprovalHistory(reportId)].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt)
  );
  const approvedHistory = history.filter((h) => h.action === "APPROVED");
  const pendingEntry = history.find((h) => h.action === "PENDING");
  const rejectedEntries = history.filter((h) => h.action === "REJECTED");
  const lastRejected =
    rejectedEntries.length > 0
      ? rejectedEntries[rejectedEntries.length - 1]
      : undefined;

  const actorDisplay = (step: ChainStep): string => {
    if (step.kind === "user") return userName(step.userId);
    const count = activeGroupMemberIds(step.groupId).length;
    return `${count} member${count !== 1 ? "s" : ""}`;
  };

  // DRAFT: mark the step that last rejected (others are pending)
  if (report.status === "DRAFT") {
    return {
      steps: chain.map((step): ApprovalChainStepDisplay => {
        const label = stepLabelOf(step, chain);
        const display = actorDisplay(step);
        if (lastRejected) {
          const isRejectedStep =
            step.kind === "user"
              ? step.userId === lastRejected.approverId
              : step.groupId === lastRejected.approvalGroupId;
          if (isRejectedStep) {
            return {
              kind: step.kind,
              label,
              actorDisplay: display,
              status: "rejected",
              actedAt: lastRejected.createdAt,
              actedByName: lastRejected.approverId
                ? userName(lastRejected.approverId)
                : undefined,
              note: lastRejected.comment,
            };
          }
        }
        return { kind: step.kind, label, actorDisplay: display, status: "pending" };
      }),
      fastTracked: isFastTracked(report),
    };
  }

  // In-flight / completed: approved[i] maps to chain[i]
  const steps: ApprovalChainStepDisplay[] = chain.map((step, i) => {
    const label = stepLabelOf(step, chain);
    const display = actorDisplay(step);

    if (i < approvedHistory.length) {
      const h = approvedHistory[i];
      const who = h.approverId ? userName(h.approverId) : undefined;
      return {
        kind: step.kind,
        label,
        actorDisplay: display,
        status: "approved",
        actedAt: h.createdAt,
        actedByName: who !== "—" ? who : undefined,
        note: h.comment,
      };
    }

    if (i === approvedHistory.length && pendingEntry) {
      return {
        kind: step.kind,
        label,
        actorDisplay: display,
        status: "current",
        actedAt: pendingEntry.createdAt,
        note: pendingEntry.comment,
      };
    }

    return { kind: step.kind, label, actorDisplay: display, status: "pending" };
  });

  return { steps, fastTracked: isFastTracked(report) };
}

// Re-export approval history type consumers may want alongside the layer.
export type { ApprovalHistory };

// ---- User activity analytics ----

/** Aggregate user activity data for the analytics dashboard. */
export async function getActivityAnalytics(
  filter: ActivityFilter
): Promise<ActivityAnalyticsResult> {
  await delay(100, 300);

  const allUsers = listUsers();
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const fromTs = filter.from ? new Date(filter.from + "T00:00:00").getTime() : 0;
  const toTs = filter.to ? new Date(filter.to + "T23:59:59").getTime() : Infinity;

  // Build allowed user ID set from role/department filters.
  let allowedUserIds: Set<string> | null = null;
  if (filter.roles?.length || filter.departments?.length || filter.userIds?.length) {
    allowedUserIds = new Set<string>();
    for (const u of allUsers) {
      const roleOk = !filter.roles?.length || filter.roles.includes(u.role);
      const deptOk = !filter.departments?.length || filter.departments.includes(u.department);
      const idOk = !filter.userIds?.length || filter.userIds.includes(u.id);
      if (roleOk && deptOk && idOk) allowedUserIds.add(u.id);
    }
  }

  const pathFilter = filter.path ?? null;

  const activities = listUserActivities().filter((a) => {
    const ts = new Date(a.createdAt).getTime();
    if (ts < fromTs || ts > toTs) return false;
    if (allowedUserIds && (!a.userId || !allowedUserIds.has(a.userId))) return false;
    if (pathFilter && !a.path.includes(pathFilter)) return false;
    return true;
  });

  // KPIs
  const userVisitCounts = new Map<string, number>();
  const pageCounts = new Map<string, number>();
  for (const a of activities) {
    if (a.userId) userVisitCounts.set(a.userId, (userVisitCounts.get(a.userId) ?? 0) + 1);
    pageCounts.set(a.path, (pageCounts.get(a.path) ?? 0) + 1);
  }
  const uniqueUsers = userVisitCounts.size;
  const totalVisits = activities.length;
  const avgVisitsPerUser = uniqueUsers > 0 ? Math.round(totalVisits / uniqueUsers) : 0;
  const mostVisitedPage = [...pageCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Visits by day
  const dayMap = new Map<string, number>();
  for (const a of activities) {
    const day = a.createdAt.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const visitsByDay = [...dayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }));

  // Top pages
  const topPages = [...pageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Top users
  const topUsers = [...userVisitCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, name: userMap.get(id)?.name ?? id, count }));

  // Browser / OS / device aggregations
  const count = (items: (string | undefined)[]) => {
    const m = new Map<string, number>();
    for (const v of items) {
      const key = v ?? "Unknown";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  };
  const byBrowser = count(activities.map((a) => a.browser ?? "Unknown"));
  const byOs = count(activities.map((a) => a.os ?? "Unknown"));
  const byDevice = count(activities.map((a) => a.deviceType ?? "Desktop"));

  // Visits by hour
  const hourMap = new Map<number, number>();
  for (const a of activities) {
    const h = new Date(a.createdAt).getHours();
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }
  const byHour = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hourMap.get(hour) ?? 0,
  }));

  // Visits by role
  const roleMap = new Map<string, number>();
  for (const a of activities) {
    const role = a.userId ? (userMap.get(a.userId)?.role ?? "Unknown") : "Unknown";
    roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
  }
  const byRole = [...roleMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Detail rows (paginated)
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 100;
  const sorted = [...activities].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  );
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize).map((a) => {
    const u = a.userId ? userMap.get(a.userId) : undefined;
    return { ...a, userName: u?.name, userRole: u?.role, userDept: u?.department };
  });

  return {
    kpis: { totalVisits, uniqueUsers, avgVisitsPerUser, mostVisitedPage },
    visitsByDay,
    topPages,
    topUsers,
    byBrowser,
    byOs,
    byDevice,
    byHour,
    byRole,
    total: sorted.length,
    rows,
  };
}

/** Delete activity rows older than the configured retention window. */
export async function purgeOldActivities(): Promise<number> {
  await delay(50, 100);
  const retentionDays = parseInt(
    getSettingValue(SETTING_KEYS.analyticsRetentionDays) ?? "365",
    10
  );
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  return pruneUserActivities(cutoff);
}
