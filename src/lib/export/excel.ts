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

// Column segments are kept separate so they can be joined conditionally.
// GL Code + GL Name are included in the sheet only when includeGlColumns is true;
// the columns are omitted entirely (not blanked) for SUBMITTER/APPROVER exports.
const HEADERS_PRE_GL = [
  "Report Name",
  "Report ID",
  "Submitter",
  "Paid To",
  "Delegate",
  "Period From",
  "Period To",
  "Expense Date",
  "Expense Type",
] as const;

const HEADERS_GL = ["GL Code", "GL Name"] as const;

const HEADERS_POST_GL = [
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
] as const;

// "Amount" is the 6th column in HEADERS_POST_GL (0-indexed: 5).
// Its absolute index shifts depending on whether GL columns are present.
const AMOUNT_POST_GL_IDX = 5; // index of "Amount" within HEADERS_POST_GL

const CURRENCY_FMT = '"$"#,##0.00';

export interface ExcelExportContext {
  report: ReportDetail;
  usersById: Map<string, User>;
  typesById: Map<string, ExpenseType>;
  receiptsById: Map<string, Receipt>;
  /** Only ADMIN / ACCOUNTING see GL code + GL name. */
  includeGlColumns: boolean;
}

export function exportReportToExcel(ctx: ExcelExportContext): void {
  const { report, usersById, typesById, receiptsById, includeGlColumns } = ctx;

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

  const headers = [
    ...HEADERS_PRE_GL,
    ...(includeGlColumns ? HEADERS_GL : []),
    ...HEADERS_POST_GL,
  ];

  // Absolute column index of "Amount" shifts by 2 when GL columns are present.
  const amountCol =
    HEADERS_PRE_GL.length +
    (includeGlColumns ? HEADERS_GL.length : 0) +
    AMOUNT_POST_GL_IDX;
  const currencyCols = [amountCol, amountCol + 2]; // Amount, Calculated Amount

  const rows = report.lineItems.map((li) => {
    const type = typesById.get(li.expenseTypeId);
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
      type?.displayName ?? "",
      ...(includeGlColumns ? [type?.glCode ?? "", type?.glName ?? ""] : []),
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
    ];
  });

  const ws: WorkSheet = utils.aoa_to_sheet([[...headers], ...rows]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  styleHeader(ws, headers.length);
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
