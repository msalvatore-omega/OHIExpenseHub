// Seed data for the OHI Expense Hub prototype.
// createSeedData() returns a fresh, deep-owned snapshot every call so the store
// can mutate it freely and resetDemoData() can start clean.

import {
  DEFAULT_ANALYTICS_RETENTION_DAYS,
  DEFAULT_APP_VERSION,
  MILEAGE_RATE,
  SETTING_KEYS,
} from "@/lib/constants";
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
  UserActivity,
} from "@/lib/types";

/** Shape of the in-memory mock database. */
export interface Database {
  users: User[];
  delegates: Delegate[];
  expenseTypes: ExpenseType[];
  reports: ExpenseReport[];
  lineItems: ExpenseLineItem[];
  receipts: Receipt[];
  approvalHistory: ApprovalHistory[];
  changeLogs: ReportChangeLog[];
  outbox: MockEmail[];
  systemSettings: SystemSetting[];
  approvalGroups: ApprovalGroup[];
  approvalGroupMembers: ApprovalGroupMember[];
  userActivities: UserActivity[];
}

// --- Stable IDs (referenced across collections) ---
const U = {
  admin: "user-dana-admin",
  approver1: "user-marcus-approver",
  approver2: "user-sandra-approver",
  submitter1: "user-priya-submitter",
  submitter2: "user-leah-submitter",
  accounting: "user-tom-accounting",
} as const;

// Stable ids for the two mandatory approval groups.
const AG = {
  accounting: "group-accounting",
  executive: "group-executive",
} as const;

// Stable ids for the expense types referenced by the seed report line items.
// These reuse the matching new types so existing reports still resolve.
const ET = {
  conference: "etype-conference",
  travel: "etype-business-travel",
  mealsLocal: "etype-meals-local",
  education: "etype-education-training",
  entertainment: "etype-entertainment",
  supplies: "etype-supplies",
  subscription: "etype-subscription-dues",
  other: "etype-other-expenses",
  mileage: "etype-mileage",
  /** The "Other" free-text expense type (distinct from the "Gift" type). */
  freeOther: "etype-other",
} as const;

function buildUsers(): User[] {
  return [
    {
      id: U.admin,
      azureAdId: "aad-0001-dana",
      email: "dana.whitfield@ohi.example.com",
      name: "Dana Whitfield",
      department: "Information Technology",
      role: "ADMIN",
      isActive: true,
      managerId: null,
      approver1Id: null,
      approver2Id: null,
      approver3Id: null,
      fastTrackThreshold: 0,
    },
    {
      id: U.approver1,
      azureAdId: "aad-0002-marcus",
      email: "marcus.bell@ohi.example.com",
      name: "Marcus Bell",
      department: "Operations",
      role: "APPROVER",
      isActive: true,
      managerId: U.admin,
      approver1Id: null,
      approver2Id: null,
      approver3Id: null,
      fastTrackThreshold: 0,
    },
    {
      id: U.approver2,
      azureAdId: "aad-0003-sandra",
      email: "sandra.klein@ohi.example.com",
      name: "Sandra Klein",
      department: "Finance",
      role: "APPROVER",
      isActive: true,
      managerId: U.admin,
      approver1Id: null,
      approver2Id: null,
      approver3Id: null,
      fastTrackThreshold: 0,
    },
    {
      id: U.submitter1,
      azureAdId: "aad-0004-priya",
      email: "priya.raman@ohi.example.com",
      name: "Priya Raman",
      department: "Operations",
      role: "SUBMITTER",
      isActive: true,
      managerId: U.approver1,
      // Two-step chain: Marcus then Sandra (note Sandra is not Priya's manager).
      approver1Id: U.approver1,
      approver2Id: U.approver2,
      approver3Id: null,
      // Fast-track: small reports skip Approver #2 (Sandra) and go to the groups.
      fastTrackThreshold: 1000,
    },
    {
      id: U.submitter2,
      azureAdId: "aad-0005-leah",
      email: "leah.gonzalez@ohi.example.com",
      name: "Leah Gonzalez",
      department: "Finance",
      role: "SUBMITTER",
      isActive: true,
      managerId: U.approver2,
      // Single-step chain: Sandra approves on her own.
      approver1Id: U.approver2,
      approver2Id: null,
      approver3Id: null,
      fastTrackThreshold: 0,
    },
    {
      id: U.accounting,
      azureAdId: "aad-0006-tom",
      email: "tom.becker@ohi.example.com",
      name: "Tom Becker",
      department: "Finance",
      role: "ACCOUNTING",
      isActive: true,
      managerId: U.approver2,
      approver1Id: null,
      approver2Id: null,
      approver3Id: null,
      fastTrackThreshold: 0,
    },
  ];
}

export function buildApprovalGroups(): ApprovalGroup[] {
  return [
    { id: AG.accounting, key: "ACCOUNTING", name: "Accounting Approval", createdAt: "2026-01-01T00:00:00.000Z" },
    { id: AG.executive, key: "EXECUTIVE", name: "Executive Approval", createdAt: "2026-01-01T00:00:00.000Z" },
  ];
}

export function buildApprovalGroupMembers(): ApprovalGroupMember[] {
  return [
    // Accounting Approval — Tom Becker (Accounting).
    { id: "agm-acct-tom", groupId: AG.accounting, userId: U.accounting, isActive: true, createdAt: "2026-01-01T00:00:00.000Z" },
    // Executive Approval — Dana Whitfield (Admin).
    { id: "agm-exec-dana", groupId: AG.executive, userId: U.admin, isActive: true, createdAt: "2026-01-01T00:00:00.000Z" },
  ];
}

function buildDelegates(): Delegate[] {
  return [
    {
      id: "delegate-001",
      principalId: U.submitter1,
      delegateId: U.submitter2,
      isActive: true,
    },
    {
      id: "delegate-002",
      principalId: U.approver1,
      delegateId: U.admin,
      isActive: false,
    },
  ];
}

export function buildExpenseTypes(): ExpenseType[] {
  // The 26 GL-coded expense types (incl. Mileage). IDs for types that match a
  // pre-existing category reuse the old id so seeded report line items resolve.
  const t = (
    id: string,
    displayName: string,
    glCode: string,
    glName: string
  ): ExpenseType => ({ id, displayName, glCode, glName, isMileage: false });

  return [
    t(ET.travel, "Travel", "MR5100501000", "Business Travel"),
    t("etype-travel-ops", "Travel Ops", "MR5100501001", "Business Travel - Ops"),
    t("etype-travel-ir", "Travel IR", "MR5100501002", "Business Travel - IR"),
    t("etype-travel-fin", "Travel Fin", "MR5100501003", "Business Travel - Fin"),
    t(ET.mealsLocal, "Meals", "MR5100501010", "Meals"),
    t(ET.entertainment, "Entertainment", "MR5100501020", "Entertainment Expense"),
    t("etype-phone", "Phone", "MR5100501050", "Occupancy Exp - Communications"),
    t(ET.supplies, "Supplies", "MR5100501120", "Supplies & Equip Exp"),
    t(ET.conference, "Conference", "MR5100502100", "Conferences Other"),
    t("etype-contributions", "Contributions", "MR5100502160", "Donations & Contributions"),
    t(ET.subscription, "Prof Dues", "MR5100502000", "Prof Dues - Business"),
    t(ET.education, "Education", "MR5100502110", "Education"),
    t("etype-directors", "Directors", "MR5100500230", "Public Co Exp-Directors Fees"),
    t(ET.other, "Gift", "MR5100600000", "Misc Exp - Admin"),
    t("etype-postage", "Postage", "MR5100502150", "Postage & Courier Exp"),
    t("etype-it", "IT", "MR5100501230", "Computer Hardware"),
    t("etype-donations", "Donations", "MR5100502160", "Donations & Contributions"),
    t("etype-prepaid", "Prepaid", "MR1810001007", "PPD Exp - Conferences"),
    t("etype-ndr", "NDR", "MR5100502101", "NDR / Investor Conferences"),
    t("etype-nic", "NIC", "MR5100502102", "NIC"),
    t("etype-operator", "Operator", "MR5100502103", "Operator Conference"),
    t("etype-recruiting", "Recruiting", "MR5100500020", "Recruiting Fees"),
    t("etype-state", "State", "MR5100500320", "State Tax Expense"),
    t("etype-software", "Computer Software EXP", "MR5100501220", "Software Exp"),
    t("etype-ait", "AIT", "MR4000003050", "Revenue - AIT - Admin in Training"),
    // Free-text "Other" — submitter must describe; GL filled in by accounting if needed.
    { id: ET.freeOther, displayName: "Other", glCode: "", glName: "Other", isMileage: false },
    // Mileage: GL code blank for now (fillable later from the Admin tab).
    { id: ET.mileage, displayName: "Mileage", glCode: "", glName: "Mileage", isMileage: true },
  ];
}

function buildOutbox(): MockEmail[] {
  return [];
}

function buildChangeLogs(): ReportChangeLog[] {
  return [];
}

/** Initial system settings: app version + (empty) announcement banner. */
export function buildSystemSettings(): SystemSetting[] {
  const updatedAt = "2026-01-01T00:00:00.000Z";
  return [
    { id: "setting-app-version", key: SETTING_KEYS.appVersion, value: DEFAULT_APP_VERSION, updatedAt },
    { id: "setting-announcement", key: SETTING_KEYS.announcement, value: "", updatedAt },
    {
      id: "setting-analytics-retention",
      key: SETTING_KEYS.analyticsRetentionDays,
      value: String(DEFAULT_ANALYTICS_RETENTION_DAYS),
      updatedAt,
    },
    { id: "setting-mileage-rate", key: SETTING_KEYS.mileageRate, value: String(MILEAGE_RATE), updatedAt },
  ];
}

export function createSeedData(): Database {
  return {
    users: buildUsers(),
    delegates: buildDelegates(),
    expenseTypes: buildExpenseTypes(),
    reports: [],
    lineItems: [],
    receipts: [],
    approvalHistory: [],
    changeLogs: buildChangeLogs(),
    outbox: buildOutbox(),
    systemSettings: buildSystemSettings(),
    approvalGroups: buildApprovalGroups(),
    approvalGroupMembers: buildApprovalGroupMembers(),
    userActivities: [],
  };
}

/** Stable ID maps, exported for use in other mock modules (e.g. duplicates). */
export const SEED_IDS = { users: U, expenseTypes: ET, approvalGroups: AG } as const;
