// In-memory mock store, persisted to localStorage under STORAGE_KEY.
// All access goes through getDb(); every mutation calls persist().
// localStorage is guarded for SSR safety — on the server the store falls back
// to a fresh in-memory seed and never touches window.

import { STORAGE_KEY } from "@/lib/constants";
import {
  buildApprovalGroupMembers,
  buildApprovalGroups,
  buildExpenseTypes,
  buildSystemSettings,
  createSeedData,
  type Database,
} from "@/lib/data/seed";
import type {
  ApprovalGroup,
  ApprovalGroupMember,
  ApprovalHistory,
  Delegate,
  ExpenseLineItem,
  ExpenseReport,
  ExpenseType,
  MockEmail,
  Receipt,
  ReportChangeLog,
  SystemSetting,
  User,
} from "@/lib/types";

let db: Database | null = null;

const isBrowser = () => typeof window !== "undefined";

function loadFromStorage(): Database | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Database;
  } catch {
    // Corrupt or unavailable storage — fall back to a fresh seed.
    return null;
  }
}

function persist(): void {
  if (!isBrowser() || !db) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignore quota / private-mode write failures in the prototype.
  }
}

/** Lazily initialize and return the singleton database. */
export function getDb(): Database {
  if (db) return db;
  db = loadFromStorage() ?? createSeedData();
  // Forward-compat: older persisted snapshots predate some collections/fields.
  if (!db.changeLogs) db.changeLogs = [];
  if (!db.systemSettings) db.systemSettings = buildSystemSettings();
  // Replace legacy expense types (pre-GL-coding) wholesale with the new GL set.
  if (
    db.expenseTypes.some(
      (t) => (t as { glCode?: string }).glCode === undefined
    )
  ) {
    db.expenseTypes = buildExpenseTypes();
  }
  // Add the "Other" free-text type if missing from stored data.
  if (!db.expenseTypes.some((t) => t.id === "etype-other")) {
    const full = buildExpenseTypes();
    const otherType = full.find((t) => t.id === "etype-other");
    if (otherType) db.expenseTypes.push(otherType);
  }
  if (!db.approvalGroups) db.approvalGroups = buildApprovalGroups();
  if (!db.approvalGroupMembers)
    db.approvalGroupMembers = buildApprovalGroupMembers();
  for (const u of db.users) {
    if (u.isActive === undefined) u.isActive = true;
    if (u.approver1Id === undefined) u.approver1Id = null;
    if (u.approver2Id === undefined) u.approver2Id = null;
    if (u.approver3Id === undefined) u.approver3Id = null;
    if (u.fastTrackThreshold === undefined) u.fastTrackThreshold = 0;
  }
  for (const r of db.receipts) {
    if (r.uploadedById === undefined) r.uploadedById = r.userId;
    if (r.source === undefined) r.source = "UPLOAD";
  }
  // Migrate IN_REVIEW reports that are actually parked at a group step.
  for (const r of db.reports) {
    if ((r.status as string) === "IN_REVIEW") {
      const pending = db.approvalHistory.find(
        (h) => h.reportId === r.id && h.action === "PENDING" && h.approvalGroupId
      );
      if (pending?.approvalGroupId) {
        const group = db.approvalGroups.find((g) => g.id === pending.approvalGroupId);
        if (group?.key === "ACCOUNTING") r.status = "ACCOUNTING_REVIEW";
        else if (group?.key === "EXECUTIVE") r.status = "EXECUTIVE_REVIEW";
      }
    }
  }
  persist();
  return db;
}

/** Clear persisted data and reseed. Used by the dev "Reset demo data" control. */
export function resetDemoData(): void {
  db = createSeedData();
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  persist();
}

// ---- ID + time helpers ----

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---- Reference reads ----

export function listUsers() {
  return getDb().users;
}

export function insertUser(user: User): User {
  getDb().users.push(user);
  persist();
  return user;
}

export function patchUser(id: string, patch: Partial<User>): User | undefined {
  const user = getDb().users.find((u) => u.id === id);
  if (!user) return undefined;
  Object.assign(user, patch);
  persist();
  return user;
}

/** Hard-remove a user row. Caller must ensure there are no related records. */
export function removeUser(id: string): boolean {
  const data = getDb();
  const exists = data.users.some((u) => u.id === id);
  data.users = data.users.filter((u) => u.id !== id);
  persist();
  return exists;
}

/**
 * Whether a user is referenced by any report, approval-history entry, delegate
 * record, or change-log entry — i.e. whether a hard delete would orphan data.
 */
export function userHasRelations(id: string): boolean {
  const data = getDb();
  return (
    data.reports.some(
      (r) =>
        r.submitterId === id || r.onBehalfOfId === id || r.paidToId === id
    ) ||
    data.approvalHistory.some((h) => h.approverId === id) ||
    data.delegates.some((d) => d.principalId === id || d.delegateId === id) ||
    data.changeLogs.some((c) => c.changedById === id)
  );
}

export function listExpenseTypes() {
  return getDb().expenseTypes;
}

export function insertExpenseType(type: ExpenseType): ExpenseType {
  getDb().expenseTypes.push(type);
  persist();
  return type;
}

export function patchExpenseType(
  id: string,
  patch: Partial<ExpenseType>
): ExpenseType | undefined {
  const type = getDb().expenseTypes.find((t) => t.id === id);
  if (!type) return undefined;
  Object.assign(type, patch);
  persist();
  return type;
}

export function listDelegates() {
  return getDb().delegates;
}

export function insertDelegate(delegate: Delegate): Delegate {
  getDb().delegates.push(delegate);
  persist();
  return delegate;
}

export function removeDelegate(id: string): boolean {
  const data = getDb();
  const exists = data.delegates.some((d) => d.id === id);
  data.delegates = data.delegates.filter((d) => d.id !== id);
  persist();
  return exists;
}

// ---- Reports ----

export function listReports(): ExpenseReport[] {
  return getDb().reports;
}

export function findReport(id: string): ExpenseReport | undefined {
  return getDb().reports.find((r) => r.id === id);
}

export function insertReport(report: ExpenseReport): ExpenseReport {
  getDb().reports.push(report);
  persist();
  return report;
}

export function patchReport(
  id: string,
  patch: Partial<ExpenseReport>
): ExpenseReport | undefined {
  const report = findReport(id);
  if (!report) return undefined;
  Object.assign(report, patch, { updatedAt: nowIso() });
  persist();
  return report;
}

/** Delete a report and cascade to its line items, history, and change log. */
export function removeReport(id: string): boolean {
  const data = getDb();
  const exists = data.reports.some((r) => r.id === id);
  if (!exists) return false;
  data.reports = data.reports.filter((r) => r.id !== id);
  data.lineItems = data.lineItems.filter((li) => li.reportId !== id);
  data.approvalHistory = data.approvalHistory.filter((h) => h.reportId !== id);
  data.changeLogs = data.changeLogs.filter((c) => c.reportId !== id);
  persist();
  return true;
}

/** Recompute and store a report's total from its line items. */
export function recalcReportTotal(reportId: string): number {
  const total = round2(
    listLineItems(reportId).reduce((sum, li) => sum + li.amount, 0)
  );
  patchReport(reportId, { totalAmount: total });
  return total;
}

// ---- Line items ----

export function listLineItems(reportId?: string): ExpenseLineItem[] {
  const items = getDb().lineItems;
  return reportId ? items.filter((li) => li.reportId === reportId) : items;
}

export function insertLineItem(item: ExpenseLineItem): ExpenseLineItem {
  getDb().lineItems.push(item);
  persist();
  return item;
}

export function patchLineItem(
  id: string,
  patch: Partial<ExpenseLineItem>
): ExpenseLineItem | undefined {
  const item = getDb().lineItems.find((li) => li.id === id);
  if (!item) return undefined;
  Object.assign(item, patch);
  persist();
  return item;
}

export function removeLineItem(id: string): void {
  const data = getDb();
  data.lineItems = data.lineItems.filter((li) => li.id !== id);
  persist();
}

/** Replace all line items for a report with the provided set. */
export function replaceLineItemsForReport(
  reportId: string,
  items: ExpenseLineItem[]
): void {
  const data = getDb();
  data.lineItems = data.lineItems
    .filter((li) => li.reportId !== reportId)
    .concat(items);
  persist();
}

// ---- Receipts ----

export function listReceipts(): Receipt[] {
  return getDb().receipts;
}

/**
 * Whether currentUser may view/work in ownerId's gallery: true if it's their own
 * gallery, or an active delegation from ownerId to currentUser exists.
 */
export function canAccessGallery(
  currentUserId: string,
  ownerId: string
): boolean {
  if (currentUserId === ownerId) return true;
  return getDb().delegates.some(
    (d) =>
      d.delegateId === currentUserId &&
      d.principalId === ownerId &&
      d.isActive
  );
}

export function findReceipt(id: string): Receipt | undefined {
  return getDb().receipts.find((r) => r.id === id);
}

export function insertReceipt(receipt: Receipt): Receipt {
  getDb().receipts.push(receipt);
  persist();
  return receipt;
}

export function patchReceipt(
  id: string,
  patch: Partial<Receipt>
): Receipt | undefined {
  const receipt = findReceipt(id);
  if (!receipt) return undefined;
  Object.assign(receipt, patch);
  persist();
  return receipt;
}

// ---- Approval history ----

export function listApprovalHistory(reportId?: string): ApprovalHistory[] {
  const history = getDb().approvalHistory;
  return reportId ? history.filter((h) => h.reportId === reportId) : history;
}

export function insertApprovalHistory(entry: ApprovalHistory): ApprovalHistory {
  getDb().approvalHistory.push(entry);
  persist();
  return entry;
}

export function patchApprovalHistory(
  id: string,
  patch: Partial<ApprovalHistory>
): ApprovalHistory | undefined {
  const entry = getDb().approvalHistory.find((h) => h.id === id);
  if (!entry) return undefined;
  Object.assign(entry, patch);
  persist();
  return entry;
}

/** Drop all approval-history entries for a report (resets the workflow). */
export function clearApprovalHistory(reportId: string): void {
  const data = getDb();
  data.approvalHistory = data.approvalHistory.filter(
    (h) => h.reportId !== reportId
  );
  persist();
}

/**
 * Remove only PENDING and APPROVED entries for a report, preserving REJECTED
 * records so the full rejection history accumulates across resubmission cycles.
 */
export function clearWorkflowHistory(reportId: string): void {
  const data = getDb();
  data.approvalHistory = data.approvalHistory.filter(
    (h) =>
      !(
        h.reportId === reportId &&
        (h.action === "PENDING" || h.action === "APPROVED")
      )
  );
  persist();
}

// ---- Report change log (audit trail) ----

export function listChangeLogs(reportId?: string): ReportChangeLog[] {
  const logs = getDb().changeLogs;
  return reportId ? logs.filter((c) => c.reportId === reportId) : logs;
}

export function insertChangeLog(entry: ReportChangeLog): ReportChangeLog {
  getDb().changeLogs.push(entry);
  persist();
  return entry;
}

// ---- Approval groups ----

export function listApprovalGroups(): ApprovalGroup[] {
  return getDb().approvalGroups;
}

export function listApprovalGroupMembers(): ApprovalGroupMember[] {
  return getDb().approvalGroupMembers;
}

export function insertApprovalGroupMember(
  member: ApprovalGroupMember
): ApprovalGroupMember {
  getDb().approvalGroupMembers.push(member);
  persist();
  return member;
}

export function removeApprovalGroupMember(id: string): boolean {
  const data = getDb();
  const exists = data.approvalGroupMembers.some((m) => m.id === id);
  data.approvalGroupMembers = data.approvalGroupMembers.filter(
    (m) => m.id !== id
  );
  persist();
  return exists;
}

// ---- Mock email outbox ----

export function listOutbox(): MockEmail[] {
  return getDb().outbox;
}

export function insertEmail(email: MockEmail): MockEmail {
  getDb().outbox.push(email);
  persist();
  return email;
}

// ---- System settings (key-value) ----

export function listSystemSettings(): SystemSetting[] {
  return getDb().systemSettings;
}

export function getSettingValue(key: string): string | undefined {
  return getDb().systemSettings.find((s) => s.key === key)?.value;
}

/** Upsert a setting row by key, stamping updatedAt. */
export function upsertSetting(key: string, value: string): SystemSetting {
  const data = getDb();
  const existing = data.systemSettings.find((s) => s.key === key);
  if (existing) {
    existing.value = value;
    existing.updatedAt = nowIso();
    persist();
    return existing;
  }
  const row: SystemSetting = {
    id: newId("setting"),
    key,
    value,
    updatedAt: nowIso(),
  };
  data.systemSettings.push(row);
  persist();
  return row;
}
