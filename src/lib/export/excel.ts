// Excel export via xlsx-js-style (SheetJS fork with style write support).
// One row per line item. Bold header, autofilter, currency number format, and
// column widths are applied. (Frozen panes are a SheetJS Pro-only feature and
// are not available in the community/style builds.)

import { utils, write, type CellObject, type WorkSheet } from "xlsx-js-style";

import type {
  DuplicateGroup,
  ExpenseType,
  LedgerEntry,
  Receipt,
  ReportChangeLog,
  ReportDetail,
  User,
} from "@/lib/types";

type StyledCell = CellObject & { s?: Record<string, unknown> };

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "0B2545" } },
  alignment: { horizontal: "left" },
};

function styleHeader(ws: WorkSheet, colCount: number) {
  for (let c = 0; c < colCount; c++) {
    const cell = ws[utils.encode_cell({ r: 0, c })] as StyledCell | undefined;
    if (cell) cell.s = HEADER_STYLE;
  }
}

function applyCurrency(ws: WorkSheet, rowCount: number, cols: number[]) {
  for (let r = 1; r <= rowCount; r++) {
    for (const c of cols) {
      const cell = ws[utils.encode_cell({ r, c })] as CellObject | undefined;
      if (cell && typeof cell.v === "number") cell.z = CURRENCY_FMT;
    }
  }
}

function downloadWorkbook(ws: WorkSheet, sheetName: string, fileBase: string) {
  if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, sheetName);
  const data = write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const safe =
    fileBase.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || "export";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// GL Code and GL Name are always included — exports are accounting-facing documents.
const HEADERS = [
  "Report Name",
  "Report ID",
  "Submitter",
  "Paid To",
  "Delegate",
  "Period From",
  "Period To",
  "Expense Date",
  "Expense Type",
  "GL Code",
  "GL Name",
  "Purpose",
  "Description",
  "City",
  "State",
  "Country",
  "Amount",
  "Miles",
  "Calculated Amount",
  "Receipt Attached",
  "Status",
  "Approved By",
  "Approval Date",
  "Reclassified By",
  "Reclassify Reason",
] as const;

// "Amount" is at index 16 (0-based) in HEADERS.
const AMOUNT_COL = 16;

const CURRENCY_FMT = '"$"#,##0.00';

export interface ExcelExportContext {
  report: ReportDetail;
  usersById: Map<string, User>;
  typesById: Map<string, ExpenseType>;
  receiptsById: Map<string, Receipt>;
  /** Change log entries keyed by line-item ID (most recent reclassification per item). */
  changeLogsByLineItemId?: Map<string, ReportChangeLog>;
  /** @deprecated GL columns are now always included; this parameter is ignored. */
  includeGlColumns?: boolean;
}

export function exportReportToExcel(ctx: ExcelExportContext): void {
  const { report, usersById, typesById, receiptsById, changeLogsByLineItemId } = ctx;

  const name = (id?: string) => (id && usersById.get(id)?.name) || "";
  const ownerId = report.onBehalfOfId ?? report.submitterId;
  const submitter = name(ownerId);
  const delegate = report.onBehalfOfId ? name(report.submitterId) : "";
  const paidTo = name(report.paidToId);

  const approved = [...report.approvalHistory]
    .reverse()
    .find((h) => h.action === "APPROVED");
  const approvedBy = approved ? name(approved.approverId) : "";
  const approvalDate = approved ? approved.createdAt.slice(0, 10) : "";

  const currencyCols = [AMOUNT_COL, AMOUNT_COL + 2]; // Amount, Calculated Amount

  const otherTypeId = [...typesById.values()].find(
    (t) => !t.isMileage && t.displayName === "Other"
  )?.id;

  const rows = report.lineItems.map((li) => {
    const type = typesById.get(li.expenseTypeId);
    const isOther = li.expenseTypeId === otherTypeId;
    const typeDisplay =
      isOther && li.otherDescription
        ? `Other — ${li.otherDescription}`
        : (type?.displayName ?? "");
    const attached =
      li.receiptId && receiptsById.get(li.receiptId) ? "Yes" : "No";
    return [
      report.reportName,
      report.id,
      submitter,
      paidTo,
      delegate,
      report.periodFrom,
      report.periodTo,
      li.expenseDate,
      typeDisplay,
      li.glCodeOverride ?? type?.glCode ?? "",
      li.glNameOverride ?? type?.glName ?? "",
      li.purposeOfTrip,
      li.description,
      li.city,
      li.state,
      li.country,
      li.amount,
      li.miles ?? "",
      li.calculatedAmount ?? "",
      attached,
      report.status,
      approvedBy,
      approvalDate,
      // Reclassification columns — always emitted, blank when not reclassified.
      (() => {
        const log = changeLogsByLineItemId?.get(li.id);
        if (!log) return "";
        const who = name(log.changedById);
        const when = log.changedAt.slice(0, 10);
        return who ? `${who} on ${when}` : when;
      })(),
      changeLogsByLineItemId?.get(li.id)?.note ?? "",
    ];
  });

  const ws: WorkSheet = utils.aoa_to_sheet([[...HEADERS], ...rows]);
  ws["!cols"] = [...HEADERS].map((h) => ({ wch: Math.max(12, h.length + 2) }));
  styleHeader(ws, HEADERS.length);
  applyCurrency(ws, rows.length, currencyCols);
  downloadWorkbook(ws, "Expense Report", report.reportName || "expense-report");
}

const DUP_HEADERS = [
  "Group",
  "Confidence",
  "Reason",
  "Recommended Action",
  "Line Item ID",
  "Report",
  "Date",
  "Expense Type",
  "Amount",
  "Group Duplicated Total",
] as const;

export function exportDuplicatesToExcel(
  groups: DuplicateGroup[],
  detailsById: Map<string, LedgerEntry>
): void {
  const rows: (string | number)[][] = [];
  for (const g of groups) {
    const ids = g.lineItemIds.length > 0 ? g.lineItemIds : [""];
    for (const id of ids) {
      const d = id ? detailsById.get(id) : undefined;
      rows.push([
        g.duplicateGroupId,
        g.confidence,
        g.reason,
        g.recommendedAction,
        id,
        d?.reportName ?? "",
        d?.expenseDate ?? "",
        d?.expenseTypeName ?? "",
        d?.amount ?? "",
        g.totalDuplicatedAmount,
      ]);
    }
  }

  const ws: WorkSheet = utils.aoa_to_sheet([[...DUP_HEADERS], ...rows]);
  ws["!cols"] = DUP_HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  styleHeader(ws, DUP_HEADERS.length);
  applyCurrency(ws, rows.length, [8, 9]); // Amount, Group Duplicated Total
  downloadWorkbook(ws, "Duplicates", "duplicate-report");
}
