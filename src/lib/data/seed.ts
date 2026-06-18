// Seed data for the OHI Expense Hub prototype.
// createSeedData() returns a fresh, deep-owned snapshot every call so the store
// can mutate it freely and resetDemoData() can start clean.

import {
  DEFAULT_APP_VERSION,
  MILEAGE_RATE,
  SETTING_KEYS,
} from "@/lib/constants";
import type {
  ApprovalHistory,
  Delegate,
  ExpenseLineItem,
  ExpenseReport,
  ExpenseType,
  MockEmail,
  Receipt,
  ReceiptSource,
  ReportChangeLog,
  SystemSetting,
  User,
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
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// --- Stable IDs (referenced across collections) ---
const U = {
  admin: "user-dana-admin",
  approver1: "user-marcus-approver",
  approver2: "user-sandra-approver",
  submitter1: "user-priya-submitter",
  submitter2: "user-leah-submitter",
  accounting: "user-tom-accounting",
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
    },
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
    // Mileage: GL code blank for now (fillable later from the Admin tab).
    { id: ET.mileage, displayName: "Mileage", glCode: "", glName: "Mileage", isMileage: true },
  ];
}

function buildReceipts(): Omit<Receipt, "uploadedById" | "source">[] {
  return [
    {
      id: "receipt-marriott",
      userId: U.submitter1,
      imageUrl: "/receipts/marriott.jpg",
      merchantName: "Marriott",
      merchantDate: "2026-05-12",
      totalAmount: 642.18,
      taxAmount: 58.74,
      isAttached: true,
      createdAt: "2026-05-12T19:02:00.000Z",
    },
    {
      id: "receipt-delta",
      userId: U.submitter1,
      imageUrl: "/receipts/delta.jpg",
      merchantName: "Delta Air Lines",
      merchantDate: "2026-05-10",
      totalAmount: 418.4,
      taxAmount: 31.6,
      isAttached: true,
      createdAt: "2026-05-10T08:15:00.000Z",
    },
    {
      id: "receipt-chipotle",
      userId: U.submitter2,
      imageUrl: "/receipts/chipotle.jpg",
      merchantName: "Chipotle",
      merchantDate: "2026-05-18",
      totalAmount: 14.27,
      taxAmount: 1.06,
      isAttached: true,
      createdAt: "2026-05-18T12:34:00.000Z",
    },
    {
      id: "receipt-office-depot",
      userId: U.submitter2,
      imageUrl: "/receipts/office-depot.jpg",
      merchantName: "Office Depot",
      merchantDate: "2026-05-21",
      totalAmount: 87.93,
      taxAmount: 6.51,
      isAttached: false,
      createdAt: "2026-05-21T16:48:00.000Z",
    },
    {
      id: "receipt-shell",
      userId: U.submitter1,
      imageUrl: "/receipts/shell.jpg",
      merchantName: "Shell",
      merchantDate: "2026-05-22",
      totalAmount: 61.05,
      taxAmount: 0,
      isAttached: false,
      createdAt: "2026-05-22T07:55:00.000Z",
    },
    {
      id: "receipt-hilton",
      userId: U.submitter2,
      imageUrl: "/receipts/hilton.jpg",
      merchantName: "Hilton",
      merchantDate: "2026-04-30",
      totalAmount: 503.77,
      taxAmount: 45.8,
      isAttached: false,
      createdAt: "2026-04-30T21:10:00.000Z",
    },
  ];
}

// Helper to build a line item, computing mileage reimbursement when applicable.
function line(
  partial: Omit<ExpenseLineItem, "calculatedAmount" | "amount"> & { amount?: number }
): ExpenseLineItem {
  if (partial.miles != null) {
    const calculatedAmount = round2(partial.miles * MILEAGE_RATE);
    return { ...partial, amount: calculatedAmount, calculatedAmount };
  }
  return { ...partial, amount: partial.amount ?? 0 };
}

interface ReportSpec {
  report: Omit<ExpenseReport, "totalAmount">;
  lines: ExpenseLineItem[];
  history?: ApprovalHistory[];
}

function buildReportSpecs(): ReportSpec[] {
  return [
    // 1) DRAFT
    {
      report: {
        id: "report-001",
        reportName: "June Field Visits",
        submitterId: U.submitter1,
        paidToId: U.submitter1,
        periodFrom: "2026-06-01",
        periodTo: "2026-06-15",
        status: "DRAFT",
        createdAt: "2026-06-15T14:00:00.000Z",
        updatedAt: "2026-06-15T14:30:00.000Z",
      },
      lines: [
        line({
          id: "line-001",
          reportId: "report-001",
          expenseDate: "2026-06-03",
          purposeOfTrip: "On-site facility audit",
          description: "Drive to Hunt Valley facility",
          city: "Hunt Valley",
          state: "MD",
          country: "USA",
          expenseTypeId: ET.mileage,
          miles: 84,
        }),
        line({
          id: "line-002",
          reportId: "report-001",
          expenseDate: "2026-06-03",
          purposeOfTrip: "On-site facility audit",
          description: "Working lunch",
          city: "Hunt Valley",
          state: "MD",
          country: "USA",
          expenseTypeId: ET.mealsLocal,
          amount: 22.5,
        }),
      ],
    },

    // 2) SUBMITTED
    {
      report: {
        id: "report-002",
        reportName: "Healthcare REIT Conference",
        submitterId: U.submitter1,
        paidToId: U.submitter1,
        periodFrom: "2026-05-10",
        periodTo: "2026-05-13",
        status: "SUBMITTED",
        submittedAt: "2026-05-14T09:00:00.000Z",
        createdAt: "2026-05-13T18:00:00.000Z",
        updatedAt: "2026-05-14T09:00:00.000Z",
      },
      lines: [
        line({
          id: "line-003",
          reportId: "report-002",
          expenseDate: "2026-05-10",
          purposeOfTrip: "Industry conference",
          description: "Round-trip airfare",
          city: "Chicago",
          state: "IL",
          country: "USA",
          expenseTypeId: ET.travel,
          amount: 418.4,
          receiptId: "receipt-delta",
        }),
        line({
          id: "line-004",
          reportId: "report-002",
          expenseDate: "2026-05-11",
          purposeOfTrip: "Industry conference",
          description: "Conference registration",
          city: "Chicago",
          state: "IL",
          country: "USA",
          expenseTypeId: ET.conference,
          amount: 895,
        }),
        line({
          id: "line-005",
          reportId: "report-002",
          expenseDate: "2026-05-12",
          purposeOfTrip: "Industry conference",
          description: "Hotel — 2 nights",
          city: "Chicago",
          state: "IL",
          country: "USA",
          expenseTypeId: ET.travel,
          amount: 642.18,
          receiptId: "receipt-marriott",
        }),
      ],
      history: [
        {
          id: "history-002a",
          reportId: "report-002",
          approverId: U.approver1,
          action: "PENDING",
          createdAt: "2026-05-14T09:00:05.000Z",
        },
      ],
    },

    // 3) IN_REVIEW
    {
      report: {
        id: "report-003",
        reportName: "Q2 Supplies & Meals",
        submitterId: U.submitter2,
        paidToId: U.submitter2,
        periodFrom: "2026-05-15",
        periodTo: "2026-05-22",
        status: "IN_REVIEW",
        submittedAt: "2026-05-23T10:00:00.000Z",
        createdAt: "2026-05-22T17:00:00.000Z",
        updatedAt: "2026-05-23T15:00:00.000Z",
      },
      lines: [
        line({
          id: "line-006",
          reportId: "report-003",
          expenseDate: "2026-05-18",
          purposeOfTrip: "Team working session",
          description: "Team lunch",
          city: "Hunt Valley",
          state: "MD",
          country: "USA",
          expenseTypeId: ET.mealsLocal,
          amount: 14.27,
          receiptId: "receipt-chipotle",
        }),
        line({
          id: "line-007",
          reportId: "report-003",
          expenseDate: "2026-05-21",
          purposeOfTrip: "Office restock",
          description: "Printer toner and paper",
          city: "Hunt Valley",
          state: "MD",
          country: "USA",
          expenseTypeId: ET.supplies,
          amount: 87.93,
          receiptId: "receipt-office-depot",
        }),
      ],
      history: [
        {
          id: "history-003a",
          reportId: "report-003",
          approverId: U.approver2,
          action: "PENDING",
          createdAt: "2026-05-23T10:00:05.000Z",
        },
      ],
    },

    // 4) APPROVED
    {
      report: {
        id: "report-004",
        reportName: "Vendor Summit — San Francisco",
        submitterId: U.submitter1,
        paidToId: U.submitter1,
        periodFrom: "2026-04-20",
        periodTo: "2026-04-24",
        status: "APPROVED",
        submittedAt: "2026-04-25T09:30:00.000Z",
        createdAt: "2026-04-24T20:00:00.000Z",
        updatedAt: "2026-04-27T13:00:00.000Z",
      },
      lines: [
        line({
          id: "line-008",
          reportId: "report-004",
          expenseDate: "2026-04-21",
          purposeOfTrip: "Vendor summit",
          description: "Summit registration",
          city: "San Francisco",
          state: "CA",
          country: "USA",
          expenseTypeId: ET.conference,
          amount: 1200,
        }),
        line({
          id: "line-009",
          reportId: "report-004",
          expenseDate: "2026-04-22",
          purposeOfTrip: "Vendor summit",
          description: "Drive to airport",
          city: "Phoenix",
          state: "AZ",
          country: "USA",
          expenseTypeId: ET.mileage,
          miles: 36,
        }),
      ],
      history: [
        {
          id: "history-004a",
          reportId: "report-004",
          approverId: U.approver1,
          action: "PENDING",
          createdAt: "2026-04-25T09:30:05.000Z",
        },
        {
          id: "history-004b",
          reportId: "report-004",
          approverId: U.approver1,
          action: "APPROVED",
          comment: "Approved — within policy.",
          createdAt: "2026-04-27T13:00:00.000Z",
        },
      ],
    },

    // 5) REJECTED
    {
      report: {
        id: "report-005",
        reportName: "Client Dinner — NYC",
        submitterId: U.submitter2,
        paidToId: U.submitter2,
        periodFrom: "2026-04-08",
        periodTo: "2026-04-09",
        status: "REJECTED",
        submittedAt: "2026-04-10T11:00:00.000Z",
        createdAt: "2026-04-09T22:00:00.000Z",
        updatedAt: "2026-04-11T08:45:00.000Z",
      },
      lines: [
        line({
          id: "line-010",
          reportId: "report-005",
          expenseDate: "2026-04-08",
          purposeOfTrip: "Client relationship dinner",
          description: "Dinner with prospective tenant",
          city: "New York",
          state: "NY",
          country: "USA",
          expenseTypeId: ET.entertainment,
          amount: 386.5,
        }),
        line({
          id: "line-011",
          reportId: "report-005",
          expenseDate: "2026-04-09",
          purposeOfTrip: "Client relationship dinner",
          description: "Breakfast",
          city: "New York",
          state: "NY",
          country: "USA",
          expenseTypeId: ET.mealsLocal,
          amount: 41.8,
        }),
      ],
      history: [
        {
          id: "history-005a",
          reportId: "report-005",
          approverId: U.approver2,
          action: "PENDING",
          createdAt: "2026-04-10T11:00:05.000Z",
        },
        {
          id: "history-005b",
          reportId: "report-005",
          approverId: U.approver2,
          action: "REJECTED",
          comment: "Entertainment exceeds per-head limit; please itemize and resubmit.",
          createdAt: "2026-04-11T08:45:00.000Z",
        },
      ],
    },

    // 6) PAID
    {
      report: {
        id: "report-006",
        reportName: "March Travel — Toronto",
        submitterId: U.submitter1,
        paidToId: U.submitter1,
        periodFrom: "2026-03-03",
        periodTo: "2026-03-06",
        status: "PAID",
        submittedAt: "2026-03-07T09:00:00.000Z",
        createdAt: "2026-03-06T19:00:00.000Z",
        updatedAt: "2026-03-15T10:00:00.000Z",
      },
      lines: [
        line({
          id: "line-012",
          reportId: "report-006",
          expenseDate: "2026-03-03",
          purposeOfTrip: "International portfolio review",
          description: "Round-trip airfare",
          city: "Toronto",
          state: "ON",
          country: "Canada",
          expenseTypeId: ET.travel,
          amount: 712.0,
        }),
        line({
          id: "line-013",
          reportId: "report-006",
          expenseDate: "2026-03-03",
          purposeOfTrip: "International portfolio review",
          description: "Drive to airport",
          city: "Phoenix",
          state: "AZ",
          country: "USA",
          expenseTypeId: ET.mileage,
          miles: 36,
        }),
        line({
          id: "line-014",
          reportId: "report-006",
          expenseDate: "2026-03-04",
          purposeOfTrip: "International portfolio review",
          description: "Dinner",
          city: "Toronto",
          state: "ON",
          country: "Canada",
          expenseTypeId: ET.mealsLocal,
          amount: 58.9,
        }),
      ],
      history: [
        {
          id: "history-006a",
          reportId: "report-006",
          approverId: U.approver1,
          action: "PENDING",
          createdAt: "2026-03-07T09:00:05.000Z",
        },
        {
          id: "history-006b",
          reportId: "report-006",
          approverId: U.approver1,
          action: "APPROVED",
          comment: "Approved.",
          createdAt: "2026-03-09T14:00:00.000Z",
        },
      ],
    },

    // 7) SUBMITTED (submitted on behalf of another user by an admin/delegate)
    {
      report: {
        id: "report-007",
        reportName: "Annual Memberships & Training",
        submitterId: U.admin,
        onBehalfOfId: U.submitter2,
        paidToId: U.submitter2,
        periodFrom: "2026-06-01",
        periodTo: "2026-06-10",
        status: "SUBMITTED",
        submittedAt: "2026-06-11T09:00:00.000Z",
        createdAt: "2026-06-10T16:00:00.000Z",
        updatedAt: "2026-06-11T09:00:00.000Z",
      },
      lines: [
        line({
          id: "line-015",
          reportId: "report-007",
          expenseDate: "2026-06-02",
          purposeOfTrip: "Professional development",
          description: "Professional association annual dues",
          city: "Hunt Valley",
          state: "MD",
          country: "USA",
          expenseTypeId: ET.subscription,
          amount: 425,
        }),
        line({
          id: "line-016",
          reportId: "report-007",
          expenseDate: "2026-06-05",
          purposeOfTrip: "Professional development",
          description: "Online compliance training course",
          city: "Hunt Valley",
          state: "MD",
          country: "USA",
          expenseTypeId: ET.education,
          amount: 349,
        }),
      ],
      history: [
        {
          id: "history-007a",
          reportId: "report-007",
          approverId: U.approver2,
          action: "PENDING",
          createdAt: "2026-06-11T09:00:05.000Z",
        },
      ],
    },

    // 8) APPROVED
    {
      report: {
        id: "report-008",
        reportName: "London Site Inspection",
        submitterId: U.submitter2,
        paidToId: U.submitter2,
        periodFrom: "2026-02-17",
        periodTo: "2026-02-21",
        status: "APPROVED",
        submittedAt: "2026-02-22T10:00:00.000Z",
        createdAt: "2026-02-21T20:00:00.000Z",
        updatedAt: "2026-02-24T11:30:00.000Z",
      },
      lines: [
        line({
          id: "line-017",
          reportId: "report-008",
          expenseDate: "2026-02-18",
          purposeOfTrip: "International site inspection",
          description: "Office supplies for site visit",
          city: "London",
          state: "",
          country: "United Kingdom",
          expenseTypeId: ET.supplies,
          amount: 73.4,
        }),
        line({
          id: "line-018",
          reportId: "report-008",
          expenseDate: "2026-02-19",
          purposeOfTrip: "International site inspection",
          description: "Currency conversion fee",
          city: "London",
          state: "",
          country: "United Kingdom",
          expenseTypeId: ET.other,
          amount: 12.75,
        }),
        line({
          id: "line-019",
          reportId: "report-008",
          expenseDate: "2026-02-20",
          purposeOfTrip: "International site inspection",
          description: "Drive to airport on return",
          city: "Dallas",
          state: "TX",
          country: "USA",
          expenseTypeId: ET.mileage,
          miles: 52,
        }),
      ],
      history: [
        {
          id: "history-008a",
          reportId: "report-008",
          approverId: U.approver2,
          action: "PENDING",
          createdAt: "2026-02-22T10:00:05.000Z",
        },
        {
          id: "history-008b",
          reportId: "report-008",
          approverId: U.approver2,
          action: "APPROVED",
          comment: "Approved — documentation complete.",
          createdAt: "2026-02-24T11:30:00.000Z",
        },
      ],
    },
  ];
}

function buildOutbox(): MockEmail[] {
  return [
    {
      id: "email-seed-001",
      to: "marcus.bell@ohi.example.com",
      subject: "[OHI Expense Hub] Report awaiting your approval: Healthcare REIT Conference",
      body: "Priya Raman submitted an expense report (Healthcare REIT Conference) totaling $1,955.58 for your approval.",
      sentAt: "2026-05-14T09:00:10.000Z",
    },
    {
      id: "email-seed-002",
      to: "leah.gonzalez@ohi.example.com",
      subject: "[OHI Expense Hub] Your report was rejected: Client Dinner — NYC",
      body: "Your expense report (Client Dinner — NYC) was rejected by Sandra Klein. Reason: Entertainment exceeds per-head limit; please itemize and resubmit.",
      sentAt: "2026-04-11T08:45:05.000Z",
    },
  ];
}

/** A few illustrative audit-trail entries so the Change Log starts populated. */
function buildChangeLogs(): ReportChangeLog[] {
  return [
    {
      id: "change-001",
      reportId: "report-003",
      changedById: U.approver1,
      changedAt: "2026-05-23T14:12:00.000Z",
      changeType: "STATUS",
      field: "status",
      oldValue: "SUBMITTED",
      newValue: "IN_REVIEW",
      summary: "Status changed from Submitted to In Review",
    },
    {
      id: "change-002",
      reportId: "report-004",
      changedById: U.approver1,
      changedAt: "2026-04-26T15:30:00.000Z",
      changeType: "STATUS",
      field: "status",
      oldValue: "IN_REVIEW",
      newValue: "APPROVED",
      summary: "Status changed from In Review to Approved",
    },
    {
      id: "change-003",
      reportId: "report-006",
      changedById: U.accounting,
      changedAt: "2026-03-12T10:05:00.000Z",
      changeType: "STATUS",
      field: "status",
      oldValue: "APPROVED",
      newValue: "PAID",
      summary: "Marked as paid",
    },
  ];
}

/** Initial system settings: app version + (empty) announcement banner. */
export function buildSystemSettings(): SystemSetting[] {
  const updatedAt = "2026-01-01T00:00:00.000Z";
  return [
    { id: "setting-app-version", key: SETTING_KEYS.appVersion, value: DEFAULT_APP_VERSION, updatedAt },
    { id: "setting-announcement", key: SETTING_KEYS.announcement, value: "", updatedAt },
  ];
}

export function createSeedData(): Database {
  const specs = buildReportSpecs();

  const reports: ExpenseReport[] = specs.map((spec) => ({
    ...spec.report,
    totalAmount: round2(spec.lines.reduce((sum, li) => sum + li.amount, 0)),
  }));

  const lineItems: ExpenseLineItem[] = specs.flatMap((spec) => spec.lines);
  const approvalHistory: ApprovalHistory[] = specs.flatMap((spec) => spec.history ?? []);

  return {
    users: buildUsers(),
    delegates: buildDelegates(),
    expenseTypes: buildExpenseTypes(),
    reports,
    lineItems,
    // Most seed receipts are self-uploads; one is an emailed-in receipt (no app
    // uploader) so the gallery's "Email" source tag is visible out of the box.
    receipts: buildReceipts().map((r) => {
      const source: ReceiptSource = r.id === "receipt-hilton" ? "EMAIL" : "UPLOAD";
      return {
        ...r,
        source,
        uploadedById: source === "EMAIL" ? null : r.userId,
      };
    }),
    approvalHistory,
    changeLogs: buildChangeLogs(),
    outbox: buildOutbox(),
    systemSettings: buildSystemSettings(),
  };
}

/** Stable ID maps, exported for use in other mock modules (e.g. duplicates). */
export const SEED_IDS = { users: U, expenseTypes: ET } as const;
