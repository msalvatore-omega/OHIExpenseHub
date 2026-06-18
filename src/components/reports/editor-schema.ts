// Form shape + Zod schema for the expense report editor.
// The schema is built from the set of mileage expense-type ids so a row can be
// validated conditionally (mileage rows need miles, others need an amount).

import { z } from "zod";

export interface LineItemForm {
  id?: string;
  expenseDate: string;
  purposeOfTrip: string;
  description: string;
  city: string;
  state: string;
  country: string;
  expenseTypeId: string;
  miles?: number;
  amount?: number;
  receiptId?: string;
}

export interface ReportFormValues {
  reportName: string;
  onBehalfOfId: string; // "" = none
  periodFrom: string;
  periodTo: string;
  lineItems: LineItemForm[];
}

export function makeReportSchema(mileageTypeIds: Set<string>) {
  const lineItem = z
    .object({
      id: z.string().optional(),
      expenseDate: z.string().min(1, "Required"),
      purposeOfTrip: z.string().min(1, "Required"),
      description: z.string().min(1, "Required"),
      city: z.string().min(1, "Required"),
      state: z.string(), // optional — not all countries have a structured subdivision
      country: z.string().min(1, "Required"),
      expenseTypeId: z.string().min(1, "Select a type"),
      miles: z.number().positive("Enter miles").optional(),
      amount: z.number().positive("Enter an amount").optional(),
      receiptId: z.string().optional(),
    })
    .superRefine((val, ctx) => {
      if (!val.expenseTypeId) return;
      if (mileageTypeIds.has(val.expenseTypeId)) {
        if (val.miles == null) {
          ctx.addIssue({
            code: "custom",
            path: ["miles"],
            message: "Miles required",
          });
        }
      } else if (val.amount == null) {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message: "Amount required",
        });
      }
    });

  return z.object({
    reportName: z.string().min(1, "Report name is required"),
    onBehalfOfId: z.string(),
    periodFrom: z.string().min(1, "Start date required"),
    periodTo: z.string().min(1, "End date required"),
    lineItems: z.array(lineItem).min(1, "Add at least one line item"),
  });
}

export const EMPTY_LINE_ITEM: LineItemForm = {
  expenseDate: "",
  purposeOfTrip: "",
  description: "",
  city: "",
  state: "",
  country: "United States",
  expenseTypeId: "",
  miles: undefined,
  amount: undefined,
  receiptId: undefined,
};
