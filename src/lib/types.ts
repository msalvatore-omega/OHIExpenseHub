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

/** How a receipt entered the system (mirrors the ReceiptSource enum). */
export type ReceiptSource = "UPLOAD" | "CAMERA" | "EMAIL";

/** Category of an audited report change (mirrors the ReportChangeType enum). */
export type ReportChangeType =
  | "STATUS"
  | "AMOUNT"
  | "LINE_ITEM"
  | "FIELD"
  | "OTHER";

export interface User {
  id: string;
  /** Null until the person's first Azure AD login (matched by email). */
  azureAdId: string | null;
  email: string;
  name: string;
  department: string;
  role: UserRole;
  /** Soft-delete flag. Inactive users can't sign in or be selected. */
  isActive: boolean;
  managerId: string | null;
  /**
   * Per-user approval chain (up to 3 steps), independent of managerId. Approvals
   * for a report route through the PAYEE's chain, skipping null steps. When all
   * three are null, routing falls back to managerId, then the first ADMIN.
   */
  approver1Id: string | null;
  approver2Id: string | null;
  approver3Id: string | null;
}

/** Input for creating a new user (azureAdId is set later, on first AD login). */
export interface CreateUserInput {
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
  /** GL (general-ledger) code, e.g. "MR5100501000". */
  glCode: string;
  /** GL name / description, e.g. "Business Travel". */
  glName: string;
  isMileage: boolean;
}

export interface Receipt {
  id: string;
  /** The gallery owner this receipt belongs to. */
  userId: string;
  /**
   * Who actually uploaded it (a delegate, or the owner for self-uploads).
   * `null` for system ingestion (e.g. an emailed-in receipt has no app user).
   */
  uploadedById: string | null;
  /** How the receipt entered the system. */
  source: ReceiptSource;
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

/** A single key-value row in the SystemSettings store. */
export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

/** The known system settings, resolved into a typed view for the UI. */
export interface AppSettings {
  appVersion: string;
  announcementMessage: string;
}

/**
 * An audit-log entry recording a single change to a report after it has been
 * submitted. Mirrors the Prisma ReportChangeLog model.
 */
export interface ReportChangeLog {
  id: string;
  reportId: string;
  changedById: string;
  changedAt: string;
  changeType: ReportChangeType;
  /** The field/column that changed, when applicable (e.g. "status", "reportName"). */
  field?: string;
  oldValue?: string;
  newValue?: string;
  /** Human-readable one-line description of the change. */
  summary: string;
  /**
   * Optional free-text detail attached to the change — e.g. the required reason
   * an approver gives when sending a report back to the employee.
   */
  note?: string;
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

/** Result of deleting a draft report: how many receipts were returned to the gallery. */
export interface DeleteReportResult {
  receiptsReturned: number;
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
  /** Gallery owner the receipt belongs to. */
  userId: string;
  /** Uploader (session user). Defaults to userId for self-uploads. */
  uploadedById?: string;
  /** How the receipt was captured. Defaults to UPLOAD. */
  source?: ReceiptSource;
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

// ---- Accounting / analytics ----

export interface AnalyticsFilter {
  from?: string;
  to?: string;
  departments?: string[];
  statuses?: ReportStatus[];
}

/** A line item flattened with its report + people + type metadata. */
export interface LedgerEntry {
  lineItemId: string;
  reportId: string;
  reportName: string;
  status: ReportStatus;
  submitterId: string;
  submitterName: string;
  department: string;
  paidToId: string;
  paidToName: string;
  expenseTypeId: string;
  expenseTypeName: string;
  glCode: string;
  glName: string;
  amount: number;
  expenseDate: string;
  periodFrom: string;
  periodTo: string;
}

export interface AccountingReportRow {
  report: ExpenseReport;
  submitterName: string;
  paidToName: string;
  department: string;
}

/**
 * A change-log entry enriched with the report + actor metadata the global
 * Change Log table needs to display and filter (by person/period).
 */
export interface ReportChangeLogRow {
  change: ReportChangeLog;
  reportName: string;
  changedByName: string;
  submitterId: string;
  paidToId: string;
  periodFrom: string;
  periodTo: string;
}

export interface DelegateInput {
  principalId: string;
  delegateId: string;
}

export interface ExpenseTypeInput {
  displayName: string;
  glCode: string;
  glName: string;
  isMileage: boolean;
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
