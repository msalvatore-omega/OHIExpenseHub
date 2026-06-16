// In-memory mock store, persisted to localStorage under STORAGE_KEY.
// All access goes through getDb(); every mutation calls persist().
// localStorage is guarded for SSR safety — on the server the store falls back
// to a fresh in-memory seed and never touches window.

import { STORAGE_KEY } from "@/lib/constants";
import { createSeedData, type Database } from "@/lib/data/seed";
import type {
  ApprovalHistory,
  ExpenseLineItem,
  ExpenseReport,
  MockEmail,
  Receipt,
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

export function listExpenseTypes() {
  return getDb().expenseTypes;
}

export function listDelegates() {
  return getDb().delegates;
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

/** Delete a report and cascade to its line items and approval history. */
export function removeReport(id: string): boolean {
  const data = getDb();
  const exists = data.reports.some((r) => r.id === id);
  if (!exists) return false;
  data.reports = data.reports.filter((r) => r.id !== id);
  data.lineItems = data.lineItems.filter((li) => li.reportId !== id);
  data.approvalHistory = data.approvalHistory.filter((h) => h.reportId !== id);
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

// ---- Receipts ----

export function listReceipts(): Receipt[] {
  return getDb().receipts;
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

// ---- Mock email outbox ----

export function listOutbox(): MockEmail[] {
  return getDb().outbox;
}

export function insertEmail(email: MockEmail): MockEmail {
  getDb().outbox.push(email);
  persist();
  return email;
}
