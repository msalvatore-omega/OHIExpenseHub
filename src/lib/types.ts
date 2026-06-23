// Domain types for OHI Expense Hub.
// These mirror the eventual persisted schema so the mock layer can be swapped
// for real services (Prisma models / API DTOs) without changing the UI.

export type UserRole = "EMPLOYEE" | "ADMIN" | "ACCOUNTING";

export type ReportStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "IN_REVIEW"
  | "ACCOUNTING_REVIEW"
  | "EXECUTIVE_REVIEW"
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
  /**
   * Fast-track threshold (USD). If 0, every report goes through the full
   * approver chain. If > 0, reports below this amount skip Approvers #2/#3 and
   * go straight to the Accounting + Executive groups.
   */
  fastTrackThreshold: number;
}

/** Input for creating a new user (azureAdId is set later, on first AD login). */
export interface CreateUserInput {
  email: string;
  name: string;
  department: string;
  role: UserRole;
  managerId: string | null;
  fastTrackThreshold?: number;
}

/** The two mandatory approval groups. */
export type ApprovalGroupKey = "ACCOUNTING" | "EXECUTIVE";

export interface ApprovalGroup {
  id: string;
  key: ApprovalGroupKey;
  name: string;
  createdAt: string;
}

/** Membership of a user in an approval group (M2M). */
export interface ApprovalGroupMember {
  id: string;
  groupId: string;
  userId: string;
  isActive: boolean;
  createdAt: string;
}

/** An approval group with its members resolved, for the Admin tab. */
export interface ApprovalGroupWithMembers {
  group: ApprovalGroup;
  members: {
    /** The membership row id. */
    id: string;
    userId: string;
    name: string;
    /** Whether the member is active (membership + user both active). */
    isActive: boolean;
  }[];
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
  /** Free-text description required when expenseTypeId is the "Other" type. */
  otherDescription?: string;
  /** ISO timestamp set when accounting reclassifies this line item's type. */
  reclassifiedAt?: string;
  /** User ID of the accounting/admin who performed the reclassification. */
  reclassifiedById?: string;
}

export interface ExpenseType {
  id: string;
  displayName: string;
  /** GL (general-ledger) code, e.g. "MR5100501000". */
  glCode: string;
  /** GL name / description, e.g. "Business Travel". */
  glName: string;
  isMileage: boolean;
  /** When false the type is hidden from new-expense dropdowns but kept on historical line items. */
  isActive: boolean;
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
  /** Soft-delete timestamp. NULL = live; set = in trash. */
  deletedAt: string | null;
  /** Who moved the receipt to trash. */
  deletedById: string | null;
}

export interface ApprovalHistory {
  id: string;
  reportId: string;
  /** The acting user. Empty for a group step that is pending (no one yet). */
  approverId: string;
  /** Set when this entry belongs to an approval-group step. */
  approvalGroupId?: string;
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
  mileageRate: number;
  mileageRateUpdatedAt: string | null;
  receiptTrashRetentionDays: number;
}

/**
 * An audit-log entry recording a single change to a report after it has been
 * submitted. Mirrors the Prisma ReportChangeLog model.
 */
export interface ReportChangeLog {
  id: string;
  /** Null for system-level audit entries (e.g. expense type create/update/delete). */
  reportId: string | null;
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
  /** Who/what the report is currently with (user name or group name). */
  approverName: string;
  /** Current step label, e.g. "Approver 1", "Accounting Approval". */
  step: string;
  /** True when the report took the fast-track chain (skipped Approvers #2/#3). */
  fastTracked: boolean;
}

export interface ReportFilter {
  status?: ReportStatus;
  submitterId?: string;
  paidToId?: string;
}

export interface ReceiptFilter {
  userId?: string;
  isAttached?: boolean;
  /** When true, return only soft-deleted receipts; when false/absent return only live ones. */
  trashed?: boolean;
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
  otherDescription?: string;
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
  isActive?: boolean;
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

// ---- Approval chain display (used by the read-only report view) ----

export type ChainStepStatus = "approved" | "current" | "pending" | "rejected";

export interface ApprovalChainStepDisplay {
  kind: "user" | "group";
  /** "Approver 1", "Approver 2", "Accounting Approval", etc. */
  label: string;
  /** Person name (user steps) or "N members" (group steps). */
  actorDisplay: string;
  status: ChainStepStatus;
  /** ISO timestamp: when the step was actioned (or when it became pending). */
  actedAt?: string;
  /** For group steps: the specific member who approved/rejected. */
  actedByName?: string;
  /** Comment left by the approver for this step. */
  note?: string;
}

export interface ApprovalChainInfoResult {
  steps: ApprovalChainStepDisplay[];
  fastTracked: boolean;
}

// ---- User activity / analytics ----

export interface UserActivity {
  id: string;
  userId?: string;
  path: string;
  method: string;
  statusCode?: number;
  durationMs?: number;
  userAgent?: string;
  browser?: string;
  os?: string;
  deviceType?: string;
  ipAddress?: string;
  referer?: string;
  createdAt: string;
}

export interface ActivityFilter {
  from?: string;
  to?: string;
  userIds?: string[];
  roles?: UserRole[];
  departments?: string[];
  page?: number;
  pageSize?: number;
  path?: string;
}

export interface ActivityKpis {
  totalVisits: number;
  uniqueUsers: number;
  avgVisitsPerUser: number;
  mostVisitedPage: string;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface NamedCount {
  name: string;
  count: number;
  id?: string;
}

export interface ActivityAnalyticsResult {
  kpis: ActivityKpis;
  visitsByDay: TimeSeriesPoint[];
  topPages: NamedCount[];
  topUsers: NamedCount[];
  byBrowser: NamedCount[];
  byOs: NamedCount[];
  byDevice: NamedCount[];
  byHour: { hour: number; count: number }[];
  byRole: NamedCount[];
  total: number;
  rows: (UserActivity & { userName?: string; userRole?: string; userDept?: string })[];
}
