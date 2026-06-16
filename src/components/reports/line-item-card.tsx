"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { MILEAGE_RATE } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { ExpenseType, Receipt } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReceiptThumb } from "@/components/reports/receipt-thumb";
import { AttachReceiptDialog } from "@/components/reports/attach-receipt-dialog";
import type { ReportFormValues } from "@/components/reports/editor-schema";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive";

const toNumberOrUndefined = (v: unknown) =>
  v === "" || v == null ? undefined : Number(v);

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-xs font-medium text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function LineItemCard({
  index,
  expenseTypes,
  mileageTypeIds,
  receiptsById,
  unattachedReceipts,
  canRemove,
  onRemove,
  onAttachReceipt,
}: {
  index: number;
  expenseTypes: ExpenseType[];
  mileageTypeIds: Set<string>;
  receiptsById: Map<string, Receipt>;
  unattachedReceipts: Receipt[];
  canRemove: boolean;
  onRemove: () => void;
  onAttachReceipt: (receiptId: string) => void;
}) {
  const { register, setValue, control, formState } =
    useFormContext<ReportFormValues>();
  const errors = formState.errors.lineItems?.[index];

  const expenseTypeId = useWatch({
    control,
    name: `lineItems.${index}.expenseTypeId`,
  });
  const miles = useWatch({ control, name: `lineItems.${index}.miles` });
  const receiptId = useWatch({ control, name: `lineItems.${index}.receiptId` });

  const isMileage = mileageTypeIds.has(expenseTypeId ?? "");
  const calculated =
    isMileage && typeof miles === "number" ? miles * MILEAGE_RATE : 0;

  const typeReg = register(`lineItems.${index}.expenseTypeId`);
  const attachedReceipt = receiptId ? receiptsById.get(receiptId) : undefined;

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium">Line {index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          disabled={!canRemove}
          onClick={onRemove}
          aria-label={`Remove line ${index + 1}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Expense Date" required error={errors?.expenseDate?.message}>
          <Input type="date" {...register(`lineItems.${index}.expenseDate`)} />
        </Field>

        <Field
          label="Expense Type"
          required
          error={errors?.expenseTypeId?.message}
        >
          <select
            className={SELECT_CLASS}
            {...typeReg}
            onChange={(e) => {
              typeReg.onChange(e);
              // Switching type clears the now-irrelevant numeric field.
              if (mileageTypeIds.has(e.target.value)) {
                setValue(`lineItems.${index}.amount`, undefined);
              } else {
                setValue(`lineItems.${index}.miles`, undefined);
              }
            }}
          >
            <option value="">Select type…</option>
            {expenseTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.displayName}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Purpose of Trip"
          required
          error={errors?.purposeOfTrip?.message}
        >
          <Input {...register(`lineItems.${index}.purposeOfTrip`)} />
        </Field>

        <Field
          label="Description"
          required
          error={errors?.description?.message}
          className="col-span-2 sm:col-span-3"
        >
          <Input {...register(`lineItems.${index}.description`)} />
        </Field>

        <Field label="City" required error={errors?.city?.message}>
          <Input {...register(`lineItems.${index}.city`)} />
        </Field>
        <Field label="State" required error={errors?.state?.message}>
          <Input {...register(`lineItems.${index}.state`)} />
        </Field>
        <Field label="Country" required error={errors?.country?.message}>
          <Input {...register(`lineItems.${index}.country`)} />
        </Field>

        {isMileage ? (
          <>
            <Field label="Miles" required error={errors?.miles?.message}>
              <Input
                type="number"
                min="0"
                step="1"
                {...register(`lineItems.${index}.miles`, {
                  setValueAs: toNumberOrUndefined,
                })}
              />
            </Field>
            <Field label={`Calculated (× ${MILEAGE_RATE})`}>
              <div className="flex h-8 items-center rounded-lg border border-input bg-muted/50 px-2.5 text-sm tabular-nums text-muted-foreground">
                {formatCurrency(calculated)}
              </div>
            </Field>
          </>
        ) : (
          <Field label="Amount" required error={errors?.amount?.message}>
            <div className="relative">
              <span className="absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="pl-6"
                {...register(`lineItems.${index}.amount`, {
                  setValueAs: toNumberOrUndefined,
                })}
              />
            </div>
          </Field>
        )}

        <Field label="Receipt" className="col-span-2 sm:col-span-3">
          {attachedReceipt ? (
            <div className="flex items-center gap-3">
              <ReceiptThumb receipt={attachedReceipt} className="size-12" />
              <div className="text-xs">
                <p className="font-medium">
                  {attachedReceipt.merchantName ?? "Receipt attached"}
                </p>
                <button
                  type="button"
                  className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() =>
                    setValue(`lineItems.${index}.receiptId`, undefined, {
                      shouldDirty: true,
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <AttachReceiptDialog
              receipts={unattachedReceipts}
              onSelect={(r) => {
                setValue(`lineItems.${index}.receiptId`, r.id, {
                  shouldDirty: true,
                });
                onAttachReceipt(r.id);
              }}
            />
          )}
        </Field>
      </div>
    </div>
  );
}
