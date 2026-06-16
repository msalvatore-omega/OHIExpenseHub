// Seed data for the OHI Expense Hub prototype.
// createSeedData() returns a fresh, deep-owned snapshot every call so the store
// can mutate it freely and resetDemoData() can start clean.

import { MILEAGE_RATE } from "@/lib/constants";
import type {
  ApprovalHistory,
  Delegate,
  ExpenseLineItem,
  ExpenseReport,
  ExpenseType,
  MockEmail,
  Receipt,
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
  outbox: MockEmail[];
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
      managerId: null,
    },
    {
      id: U.approver1,
      azureAdId: "aad-0002-marcus",
      email: "marcus.bell@ohi.example.com",
      name: "Marcus Bell",
      department: "Operations",
      role: "APPROVER",
      managerId: U.admin,
    },
    {
      id: U.approver2,
      azureAdId: "aad-0003-sandra",
      email: "sandra.klein@ohi.example.com",
      name: "Sandra Klein",
      department: "Finance",
      role: "APPROVER",
      managerId: U.admin,
    },
    {
      id: U.submitter1,
      azureAdId: "aad-0004-priya",
      email: "priya.raman@ohi.example.com",
      name: "Priya Raman",
      department: "Operations",
      role: "SUBMITTER",
      managerId: U.approver1,
    },
    {
      id: U.submitter2,
      azureAdId: "aad-0005-leah",
      email: "leah.gonzalez@ohi.example.com",
      name: "Leah Gonzalez",
      department: "Finance",
      role: "SUBMITTER",
      managerId: U.approver2,
    },
    {
      id: U.accounting,
      azureAdId: "aad-0006-tom",
      email: "tom.becker@ohi.example.com",
      name: "Tom Becker",
      department: "Finance",
      role: "ACCOUNTING",
      managerId: U.approver2,
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

function buildExpenseTypes(): ExpenseType[] {
  return [
    { id: ET.conference, displayName: "Conference", accountingCode: "502100", isMileage: false },
    { id: ET.travel, displayName: "Business Travel", accountingCode: "501000", isMileage: false },
    { id: ET.mealsLocal, displayName: "Meals-Local", accountingCode: "501010", isMileage: false },
    { id: ET.education, displayName: "Education & Training", accountingCode: "502110", isMileage: false },
    { id: ET.entertainment, displayName: "Entertainment", accountingCode: "501020", isMileage: false },
    { id: ET.supplies, displayName: "Supplies", accountingCode: "501120", isMileage: false },
    { id: ET.subscription, displayName: "Subscription/Dues", accountingCode: "502000", isMileage: false },
    { id: ET.other, displayName: "Other Expenses", accountingCode: "509000", isMileage: false },
    { id: ET.mileage, displayName: "Mileage", accountingCode: "501030", isMileage: true },
  ];
}

function buildReceipts(): Receipt[] {
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
    receipts: buildReceipts(),
    approvalHistory,
    outbox: buildOutbox(),
  };
}

/** Stable ID maps, exported for use in other mock modules (e.g. duplicates). */
export const SEED_IDS = { users: U, expenseTypes: ET } as const;
