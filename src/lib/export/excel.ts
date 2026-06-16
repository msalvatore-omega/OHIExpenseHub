// Excel export via xlsx-js-style (SheetJS fork with style write support).
// One row per line item. Bold header, autofilter, currency number format, and
// column widths are applied. (Frozen panes are a SheetJS Pro-only feature and
// are not available in the community/style builds.)

import { utils, write, type CellObject, type WorkSheet } from "xlsx-js-style";

import type {
  ExpenseType,
  Receipt,
  ReportDetail,
  User,
} from "@/lib/types";

type StyledCell = CellObject & { s?: Record<string, unknown> };

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
  "Accounting Code",
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

const CURRENCY_COLS = [15, 17]; // Amount, Calculated Amount
const CURRENCY_FMT = '"$"#,##0.00';

export interface ExcelExportContext {
  report: ReportDetail;
  usersById: Map<string, User>;
  typesById: Map<string, ExpenseType>;
  receiptsById: Map<string, Receipt>;
  /** Only ADMIN / ACCOUNTING see accounting codes. */
  includeAccountingCode: boolean;
}

export function exportReportToExcel(ctx: ExcelExportContext): void {
  const { report, usersById, typesById, receiptsById, includeAccountingCode } =
    ctx;

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
      includeAccountingCode ? type?.accountingCode ?? "" : "",
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

  const ws: WorkSheet = utils.aoa_to_sheet([[...HEADERS], ...rows]);

  // Column widths.
  ws["!cols"] = HEADERS.map((h) => ({ wch: Math.max(12, h.length + 2) }));

  // Bold navy header row.
  for (let c = 0; c < HEADERS.length; c++) {
    const cell = ws[utils.encode_cell({ r: 0, c })] as StyledCell | undefined;
    if (!cell) continue;
    cell.s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "0B2545" } },
      alignment: { horizontal: "left" },
    };
  }

  // Currency format on amount columns.
  for (let r = 1; r <= rows.length; r++) {
    for (const c of CURRENCY_COLS) {
      const cell = ws[utils.encode_cell({ r, c })] as CellObject | undefined;
      if (cell && typeof cell.v === "number") cell.z = CURRENCY_FMT;
    }
  }

  // Auto-filter across the full range.
  if (ws["!ref"]) ws["!autofilter"] = { ref: ws["!ref"] };

  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, "Expense Report");

  const data = write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const safeName =
    report.reportName.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") ||
    "expense-report";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
