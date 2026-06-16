// Domain types for OHI Expense Hub.
// These mirror the eventual persisted schema so the mock layer can be swapped
// for real services (Prisma models / API DTOs) without changing the UI.

export type UserRole = "SUBMITTER" | "APPROVER" | "ADMIN" | "ACCOUNTING";

export type ReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PAID";

export type ApprovalAction = "PENDING" | "APPROVED" | "REJECTED";

export interface User {
  id: string;
  azureAdId: string;
  email: string;
  name: string;
  department: string;
  role: UserRole;
  managerId: string | null;
}

export interface Delegate {
  id: string;
  principalId: string;
  delegateId: string;
  isActive: boolean;
}

export interface ExpenseReport {
  id: string;
  reportName: string;
  submitterId: string;
  /** Set when a delegate/admin submits on behalf of another user. */
  onBehalfOfId?: string;
  /** User who is reimbursed (the "Pay to" party). */
  paidToId: string;
  periodFrom: string;
  periodTo: string;
  status: ReportStatus;
  totalAmount: number;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseLineItem {
  id: string;
  reportId: string;
  expenseDate: string;
  purposeOfTrip: string;
  description: string;
  // Location is intentionally three discrete fields, not one string.
  city: string;
  state: string;
  country: string;
  expenseTypeId: string;
  amount: number;
  /** Present for mileage line items. */
  miles?: number;
  /** Computed reimbursement for mileage (miles * rate). */
  calculatedAmount?: number;
  receiptId?: string;
}

export interface ExpenseType {
  id: string;
  displayName: string;
  accountingCode: string;
  isMileage: boolean;
}

export interface Receipt {
  id: string;
  userId: string;
  imageUrl: string;
  merchantName?: string;
  merchantDate?: string;
  totalAmount?: number;
  taxAmount?: number;
  rawOcrData?: unknown;
  isAttached: boolean;
  createdAt: string;
}

export interface ApprovalHistory {
  id: string;
  reportId: string;
  approverId: string;
  action: ApprovalAction;
  comment?: string;
  createdAt: string;
}

export interface MockEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}

// ---- Derived / view types used by the data-access layer ----

export interface Kpis {
  totalReports: number;
  draftCount: number;
  pendingApprovalCount: number;
  approvedCount: number;
  rejectedCount: number;
  paidCount: number;
  totalSubmittedAmount: number;
  totalReimbursedAmount: number;
}

/** A report with its line items and approval trail, as returned by getReport. */
export interface ReportDetail extends ExpenseReport {
  lineItems: ExpenseLineItem[];
  approvalHistory: ApprovalHistory[];
}

/** Result of an approval action: the updated report + the notifications queued. */
export interface ApprovalActionResult {
  report: ExpenseReport;
  notifications: MockEmail[];
}

/** A report enriched with the names and workflow step for routing/approval views. */
export interface ReportRoutingRow {
  report: ExpenseReport;
  submitterName: string;
  approverName: string;
  /** Human-readable workflow position, e.g. "1 of 1". */
  step: string;
}

export interface ReportFilter {
  status?: ReportStatus;
  submitterId?: string;
  paidToId?: string;
}

export interface ReceiptFilter {
  userId?: string;
  isAttached?: boolean;
}

export interface CreateDraftInput {
  reportName: string;
  submitterId: string;
  paidToId: string;
  onBehalfOfId?: string;
  periodFrom: string;
  periodTo: string;
}

/** Input for persisting a newly captured receipt. */
export interface CreateReceiptInput {
  userId: string;
  imageUrl: string;
  merchantName?: string;
  merchantDate?: string;
  totalAmount?: number;
  taxAmount?: number;
  rawOcrData?: unknown;
}

/** A line item as submitted from the editor (ids optional for new rows). */
export interface LineItemInput {
  id?: string;
  expenseDate: string;
  purposeOfTrip: string;
  description: string;
  city: string;
  state: string;
  country: string;
  expenseTypeId: string;
  amount?: number;
  miles?: number;
  receiptId?: string;
}

// ---- Mock OCR ----

export interface OcrResult {
  merchantName: string;
  transactionDate: string;
  total: number;
  tax: number;
  tip: number;
  subtotal: number;
  /** Object URL created for preview (browser only). */
  previewUrl?: string;
}

// ---- Mock duplicate detection ----

export type DuplicateConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface DuplicateGroup {
  duplicateGroupId: string;
  confidence: DuplicateConfidence;
  reason: string;
  lineItemIds: string[];
  totalDuplicatedAmount: number;
  recommendedAction: string;
}

export interface DateRange {
  from: string;
  to: string;
}

export type DuplicateSensitivity = "HIGH" | "MEDIUM" | "LOW";
