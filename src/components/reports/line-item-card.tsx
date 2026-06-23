"use client";

import * as React from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { MILEAGE_RATE } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import {
  COUNTRY_ITEMS,
  getSubdivisions,
  countryNameToCode,
} from "@/lib/location-data";
import type { ExpenseType, Receipt } from "@/lib/types";
import { useSession } from "@/lib/auth/mock-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountryCombobox, SubdivisionCombobox } from "@/components/ui/location-combobox";
import { ReceiptThumb } from "@/components/reports/receipt-thumb";
import { AttachReceiptDialog } from "@/components/reports/attach-receipt-dialog";
import type { ReportFormValues } from "@/components/reports/editor-schema";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-background text-foreground px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive";

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
  otherTypeId,
  receiptsById,
  unattachedReceipts,
  canRemove,
  onRemove,
  onAttachReceipt,
}: {
  index: number;
  expenseTypes: ExpenseType[];
  mileageTypeIds: Set<string>;
  otherTypeId: string | null;
  receiptsById: Map<string, Receipt>;
  unattachedReceipts: Receipt[];
  canRemove: boolean;
  onRemove: () => void;
  onAttachReceipt: (receiptId: string) => void;
}) {
  const { user } = useSession();
  const { register, setValue, control, formState } =
    useFormContext<ReportFormValues>();
  const errors = formState.errors.lineItems?.[index];

  const expenseTypeId = useWatch({
    control,
    name: `lineItems.${index}.expenseTypeId`,
  });
  const miles = useWatch({ control, name: `lineItems.${index}.miles` });
  const receiptId = useWatch({ control, name: `lineItems.${index}.receiptId` });
  const country = useWatch({ control, name: `lineItems.${index}.country` });
  const state = useWatch({ control, name: `lineItems.${index}.state` });
  const cityValue = useWatch({ control, name: `lineItems.${index}.city` });

  const isMileage = mileageTypeIds.has(expenseTypeId ?? "");
  const isOther = otherTypeId !== null && expenseTypeId === otherTypeId;
  const calculated =
    isMileage && typeof miles === "number" ? miles * MILEAGE_RATE : 0;

  const typeReg = register(`lineItems.${index}.expenseTypeId`);
  const attachedReceipt = receiptId ? receiptsById.get(receiptId) : undefined;

  // Derive the ISO alpha-2 country code for subdivision lookup + city API calls.
  const countryCode = React.useMemo(
    () => countryNameToCode(country ?? "") ?? "US",
    [country]
  );
  const subdivisions = React.useMemo(
    () => getSubdivisions(countryCode),
    [countryCode]
  );

  // ---- City autocomplete ----
  const [citySuggestions, setCitySuggestions] = React.useState<string[]>([]);
  const [showSugg, setShowSugg] = React.useState(false);

  // Simple debounce — 250 ms.
  const [debouncedCity, setDebouncedCity] = React.useState(cityValue);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedCity(cityValue), 250);
    return () => clearTimeout(t);
  }, [cityValue]);

  React.useEffect(() => {
    if (!debouncedCity || debouncedCity.length < 2) {
      setCitySuggestions([]);
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams({ q: debouncedCity, country: countryCode });
    if (state) params.set("state", state);

    fetch(`/api/locations/cities?${params}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { cities: [] }))
      .then(({ cities }: { cities: string[] }) =>
        setCitySuggestions(cities ?? [])
      )
      .catch(() => {
        // Abort or network error — silently ignore.
      });

    return () => controller.abort();
  }, [debouncedCity, countryCode, state]);

  // ---- Country / state change handlers ----

  function handleCountryChange(name: string) {
    setValue(`lineItems.${index}.country`, name, { shouldDirty: true });
    setValue(`lineItems.${index}.state`, "", { shouldDirty: true });
    setValue(`lineItems.${index}.city`, "", { shouldDirty: true });
    setCitySuggestions([]);
  }

  function handleStateChange(v: string) {
    setValue(`lineItems.${index}.state`, v, { shouldDirty: true });
    setValue(`lineItems.${index}.city`, "", { shouldDirty: true });
    setCitySuggestions([]);
  }

  // Banding: even-indexed cards get the tinted tier; odd get the page default.
  const isBanded = index % 2 === 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border",
        isBanded ? "bg-table-row-band" : "bg-surface"
      )}
    >
      {/* Card header — darkest tier */}
      <div className="flex items-center justify-between bg-table-header-band px-4 py-2.5">
        <span className="text-sm font-semibold">Line {index + 1}</span>
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

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
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
              if (mileageTypeIds.has(e.target.value)) {
                setValue(`lineItems.${index}.amount`, undefined);
              } else {
                setValue(`lineItems.${index}.miles`, undefined);
              }
              if (e.target.value !== otherTypeId) {
                setValue(`lineItems.${index}.otherDescription`, undefined);
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

        {isOther && (
          <Field
            label="Describe expense"
            required
            error={(errors as { otherDescription?: { message?: string } })?.otherDescription?.message}
            className="col-span-2 sm:col-span-3"
          >
            <Input
              {...register(`lineItems.${index}.otherDescription`)}
              placeholder="Describe the expense…"
            />
          </Field>
        )}

        {/* Country */}
        <Field label="Country" required error={errors?.country?.message}>
          <CountryCombobox
            value={country ?? ""}
            onChange={handleCountryChange}
            items={COUNTRY_ITEMS}
          />
        </Field>

        {/* State / Province / Region */}
        <Field label={subdivisions ? "State / Province" : "State / Region"}>
          {subdivisions ? (
            <SubdivisionCombobox
              value={state ?? ""}
              onChange={handleStateChange}
              options={subdivisions}
              placeholder="Select…"
            />
          ) : (
            <Input
              {...register(`lineItems.${index}.state`)}
              placeholder="Optional"
            />
          )}
        </Field>

        {/* City — text input with async autocomplete */}
        <Field label="City" required error={errors?.city?.message}>
          <div className="relative">
            <Input
              {...register(`lineItems.${index}.city`)}
              autoComplete="off"
              onFocus={() => setShowSugg(true)}
              onBlur={() => setTimeout(() => setShowSugg(false), 150)}
            />
            {showSugg && citySuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md">
                {citySuggestions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="flex w-full items-center px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                    onMouseDown={(e) => {
                      // Prevent blur from firing before click is registered.
                      e.preventDefault();
                      setValue(`lineItems.${index}.city`, c, {
                        shouldDirty: true,
                      });
                      setShowSugg(false);
                      setCitySuggestions([]);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
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
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
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
          {receiptId ? (
            <div className="flex items-center gap-3">
              {attachedReceipt && (
                <ReceiptThumb receipt={attachedReceipt} className="size-12" />
              )}
              <div className="text-xs">
                <p className="font-medium">
                  {attachedReceipt?.merchantName ?? "Receipt attached"}
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
              userId={user.id}
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
