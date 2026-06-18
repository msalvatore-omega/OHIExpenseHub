"use client";

// Expense report editor (used by /reports/new and /reports/[id]/edit).
// React Hook Form + Zod with inline errors. Header is persisted via
// updateReport(); line items via replaceLineItems(). Drafts auto-save every 60s.

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FormProvider,
  useFieldArray,
  useForm,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MILEAGE_RATE } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import {
  attachReceipt,
  deleteReport,
  getDelegatedPrincipals,
  getExpenseTypes,
  getReceipts,
  getReport,
  getUsers,
  replaceLineItems,
  submitReport,
  updateReport,
} from "@/lib/data";
import { useSession } from "@/lib/auth/mock-session";
import { deletedReportMessage, toastQueuedNotifications } from "@/lib/notify";
import type { LineItemInput, ReportDetail } from "@/lib/types";
import { dashboardKeys } from "@/components/dashboard/use-dashboard-data";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LineItemCard } from "@/components/reports/line-item-card";
import { ReportExportButtons } from "@/components/reports/report-export-buttons";
import {
  EMPTY_LINE_ITEM,
  makeReportSchema,
  type LineItemForm,
  type ReportFormValues,
} from "@/components/reports/editor-schema";

const editorReceiptsKey = (userId: string) =>
  ["editor-receipts", userId] as const;

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ReportEditor({ reportId }: { reportId: string }) {
  const { user } = useSession();

  const report = useQuery({
    queryKey: ["report", reportId],
    queryFn: () => getReport(reportId),
  });
  const types = useQuery({
    queryKey: ["expense-types"],
    queryFn: getExpenseTypes,
  });
  const receipts = useQuery({
    queryKey: editorReceiptsKey(user.id),
    queryFn: () => getReceipts({ userId: user.id }),
  });
  const principals = useQuery({
    queryKey: ["delegated-principals", user.id],
    queryFn: () => getDelegatedPrincipals(user.id),
  });
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers });

  // Opening a rejected report reopens it as a DRAFT for editing.
  const queryClient = useQueryClient();
  const reopenedRef = React.useRef(false);
  const status = report.data?.status;
  React.useEffect(() => {
    if (status === "REJECTED" && !reopenedRef.current) {
      reopenedRef.current = true;
      updateReport(reportId, { status: "DRAFT" }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["report", reportId] });
        queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      });
    }
  }, [status, reportId, queryClient]);

  const loading =
    report.isLoading ||
    types.isLoading ||
    receipts.isLoading ||
    principals.isLoading ||
    users.isLoading;

  if (loading) return <EditorSkeleton />;

  if (!report.data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Report not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This report may have been deleted.
        </p>
      </div>
    );
  }

  return (
    <EditorForm
      report={report.data}
      expenseTypes={types.data ?? []}
      allReceipts={receipts.data ?? []}
      principals={principals.data ?? []}
      usersById={
        new Map((users.data ?? []).map((u) => [u.id, u.name]))
      }
      currentUserId={user.id}
    />
  );
}

function EditorForm({
  report,
  expenseTypes,
  allReceipts,
  principals,
  usersById,
  currentUserId,
}: {
  report: ReportDetail;
  expenseTypes: ReportEditorTypes;
  allReceipts: ReportEditorReceipts;
  principals: { id: string; name: string }[];
  usersById: Map<string, string>;
  currentUserId: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const mileageTypeIds = React.useMemo(
    () =>
      new Set(expenseTypes.filter((t) => t.isMileage).map((t) => t.id)),
    [expenseTypes]
  );

  const schema = React.useMemo(
    () => makeReportSchema(mileageTypeIds),
    [mileageTypeIds]
  );

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      reportName: report.reportName,
      onBehalfOfId: report.onBehalfOfId ?? "",
      periodFrom: report.periodFrom,
      periodTo: report.periodTo,
      lineItems: report.lineItems.map(
        (li): LineItemForm => ({
          id: li.id,
          expenseDate: li.expenseDate,
          purposeOfTrip: li.purposeOfTrip,
          description: li.description,
          city: li.city,
          state: li.state,
          country: li.country,
          expenseTypeId: li.expenseTypeId,
          miles: li.miles ?? undefined,
          amount: mileageTypeIds.has(li.expenseTypeId)
            ? undefined
            : li.amount,
          receiptId: li.receiptId,
        })
      ),
    },
  });

  const { control, register, getValues, handleSubmit, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lineItems" });

  const isDraft = report.status === "DRAFT";

  // ---- live total + derived Paid To ----
  const watchedItems = useWatch({ control, name: "lineItems" }) ?? [];
  const total = watchedItems.reduce((sum, li) => {
    if (!li) return sum;
    const value = mileageTypeIds.has(li.expenseTypeId)
      ? (li.miles ?? 0) * MILEAGE_RATE
      : li.amount ?? 0;
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  const onBehalfOfId = useWatch({ control, name: "onBehalfOfId" });
  const submitterName = usersById.get(report.submitterId) ?? "You";
  const paidToName = onBehalfOfId
    ? usersById.get(onBehalfOfId) ?? "—"
    : submitterName;

  // ---- persistence ----
  const toInput = (li: LineItemForm): LineItemInput => ({
    id: li.id,
    expenseDate: li.expenseDate,
    purposeOfTrip: li.purposeOfTrip,
    description: li.description,
    city: li.city,
    state: li.state,
    country: li.country,
    expenseTypeId: li.expenseTypeId,
    amount: li.amount,
    miles: li.miles,
    receiptId: li.receiptId,
  });

  const persist = React.useCallback(
    async (values: ReportFormValues) => {
      await updateReport(report.id, {
        reportName: values.reportName,
        onBehalfOfId: values.onBehalfOfId || undefined,
        paidToId: values.onBehalfOfId || report.submitterId,
        periodFrom: values.periodFrom,
        periodTo: values.periodTo,
      });
      await replaceLineItems(report.id, values.lineItems.map(toInput));
      return values;
    },
    [report.id, report.submitterId]
  );

  const saveMutation = useMutation({
    mutationFn: persist,
    onSuccess: (values) => {
      form.reset(values);
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not save"),
  });

  const submitMutation = useMutation({
    mutationFn: async (values: ReportFormValues) => {
      await persist(values);
      return submitReport(report.id);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      toastQueuedNotifications(result.notifications);
      router.push("/dashboard");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not submit"),
  });

  const attachMutation = useMutation({
    mutationFn: (receiptId: string) => attachReceipt(report.id, receiptId),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: editorReceiptsKey(currentUserId),
      }),
  });

  // ---- auto-save drafts every 60s ----
  React.useEffect(() => {
    if (!isDraft) return;
    const interval = setInterval(() => {
      if (form.formState.isDirty && !saveMutation.isPending) {
        saveMutation.mutate(form.getValues(), {
          onSuccess: () => toast("Draft auto-saved"),
        });
      }
    }, 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraft]);

  // ---- delete draft ----
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const deleteMutation = useMutation({
    mutationFn: () => deleteReport(report.id, currentUserId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      // Returned receipts reappear as Unattached in the gallery + editor pickers.
      queryClient.invalidateQueries({ queryKey: ["receipts"] });
      queryClient.invalidateQueries({
        queryKey: editorReceiptsKey(currentUserId),
      });
      toast.success(deletedReportMessage(result.receiptsReturned));
      router.push("/my-expenses");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not delete"),
  });

  // ---- submit confirm dialog ----
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // The validated values awaiting confirmation. State (not a ref) so it isn't
  // read during render.
  const [pendingValues, setPendingValues] =
    React.useState<ReportFormValues | null>(null);

  const onValidSubmit = (values: ReportFormValues) => {
    setPendingValues(values);
    setConfirmOpen(true);
  };

  const receiptsById = React.useMemo(
    () => new Map(allReceipts.map((r) => [r.id, r])),
    [allReceipts]
  );
  const unattachedReceipts = allReceipts.filter((r) => !r.isAttached);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={handleSubmit(onValidSubmit)}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8"
      >
        {/* Header */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {isDraft ? "Edit Draft" : "Edit Report"}
            </h1>
            <div className="flex items-center gap-3">
              <StatusPill status={report.status} />
              <ReportExportButtons reportId={report.id} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">
                Report Name <span className="text-destructive">*</span>
              </label>
              <Input {...register("reportName")} />
              {formState.errors.reportName && (
                <p className="text-xs text-destructive">
                  {formState.errors.reportName.message}
                </p>
              )}
            </div>

            <ReadOnlyField label="Submitter" value={submitterName} />

            {principals.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  On Behalf Of
                </label>
                <select className={SELECT_CLASS} {...register("onBehalfOfId")}>
                  <option value="">— Myself —</option>
                  {principals.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <ReadOnlyField label="Paid To" value={paidToName} />

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Period From <span className="text-destructive">*</span>
              </label>
              <Input type="date" {...register("periodFrom")} />
              {formState.errors.periodFrom && (
                <p className="text-xs text-destructive">
                  {formState.errors.periodFrom.message}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Period To <span className="text-destructive">*</span>
              </label>
              <Input type="date" {...register("periodTo")} />
              {formState.errors.periodTo && (
                <p className="text-xs text-destructive">
                  {formState.errors.periodTo.message}
                </p>
              )}
            </div>
          </div>
        </header>

        {/* Line items */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Line items
            </h2>
            {typeof formState.errors.lineItems?.message === "string" && (
              <p className="text-xs text-destructive">
                {formState.errors.lineItems.message}
              </p>
            )}
          </div>

          {fields.map((field, index) => (
            <LineItemCard
              key={field.id}
              index={index}
              expenseTypes={expenseTypes}
              mileageTypeIds={mileageTypeIds}
              receiptsById={receiptsById}
              unattachedReceipts={unattachedReceipts}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
              onAttachReceipt={(receiptId) => attachMutation.mutate(receiptId)}
            />
          ))}

          <button
            type="button"
            onClick={() => append({ ...EMPTY_LINE_ITEM })}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm font-medium text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          >
            <Plus className="size-4" />
            Add Line Item
          </button>
        </section>

        {/* Sticky action bar (sits above the mobile tab bar) */}
        <div className="sticky bottom-16 z-30 -mx-6 flex items-center justify-between gap-2 border-t border-border bg-background/95 px-6 py-3 backdrop-blur md:bottom-0">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")}>
              Cancel
            </Button>
            {isDraft && (
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Total:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatCurrency(total)}
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                saveMutation.mutate(getValues(), {
                  onSuccess: () => toast.success("Draft saved"),
                })
              }
              disabled={saveMutation.isPending}
            >
              Save Draft
            </Button>
            {isDraft && (
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary-hover"
              >
                Submit for Approval
              </Button>
            )}
          </div>
        </div>
      </form>

      {/* Submit confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for approval?</DialogTitle>
            <DialogDescription>
              This report ({formatCurrency(total)}) will be sent to your
              approver and can no longer be edited as a draft.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-blue-600 text-white hover:bg-blue-600"
              disabled={submitMutation.isPending}
              onClick={() => {
                if (!pendingValues) return;
                setConfirmOpen(false);
                submitMutation.mutate(pendingValues);
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete draft confirmation */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => !deleteMutation.isPending && setDeleteOpen(o)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete draft report?</DialogTitle>
            <DialogDescription>
              This draft will be permanently deleted. Any receipts attached to it
              are returned to your Receipt Gallery (not deleted), where you can
              reuse them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}

// Helper read-only display field.
function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex h-8 items-center rounded-lg border border-input bg-muted/50 px-2.5 text-sm text-muted-foreground">
        {value}
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-8">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

// Local prop aliases to keep the EditorForm signature readable.
type ReportEditorTypes = import("@/lib/types").ExpenseType[];
type ReportEditorReceipts = import("@/lib/types").Receipt[];
