"use client";

// Receipt Gallery + capture pipeline.
// Pipeline is fully client-side: object URL -> processReceipt() (mock OCR) ->
// review modal -> persist via createReceipt(). Files are processed one at a
// time so each opens its own review modal.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { formatDate } from "@/lib/format";
import { OcrTimeoutError, processReceipt } from "@/lib/data/ocr";
import {
  attachReceipt,
  createDraft,
  createReceipt,
  getExpenseTypes,
  getReceipts,
  replaceLineItems,
} from "@/lib/data";
import { useSession } from "@/lib/auth/mock-session";
import type { LineItemInput } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadZone } from "@/components/gallery/upload-zone";
import { ReceiptCard } from "@/components/gallery/receipt-card";
import {
  OcrReviewModal,
  type ReviewItem,
} from "@/components/gallery/ocr-review-modal";

type Filter = "all" | "unattached" | "attached";

export default function GalleryPage() {
  const { user } = useSession();
  const userId = user.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const receiptsQuery = useQuery({
    queryKey: ["receipts", userId],
    queryFn: () => getReceipts({ userId }),
  });
  const typesQuery = useQuery({
    queryKey: ["expense-types"],
    queryFn: getExpenseTypes,
  });

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["receipts", userId] }),
    [queryClient, userId]
  );

  // ---- capture pipeline (sequential queue) ----
  const queueRef = React.useRef<File[]>([]);
  const busyRef = React.useRef(false);
  const [processing, setProcessing] = React.useState<string | null>(null);
  const [queuedCount, setQueuedCount] = React.useState(0);
  const [review, setReview] = React.useState<ReviewItem | null>(null);
  const [saving, setSaving] = React.useState(false);

  const pump = React.useCallback(() => {
    if (busyRef.current) return;
    const file = queueRef.current.shift();
    setQueuedCount(queueRef.current.length);
    if (!file) return;
    busyRef.current = true;

    void (async () => {
      const previewUrl = URL.createObjectURL(file);
      const isPdf = file.type === "application/pdf";
      setProcessing(file.name);
      try {
        const ocr = await processReceipt(file);
        setProcessing(null);
        setReview({ file, previewUrl, isPdf, ocr });
        // busy stays true until the user saves/discards in the modal.
      } catch (err) {
        setProcessing(null);
        if (err instanceof OcrTimeoutError) {
          try {
            await createReceipt({ userId, imageUrl: previewUrl });
            refresh();
            toast.warning(
              "OCR timed out — receipt saved, please fill in details manually."
            );
          } catch {
            URL.revokeObjectURL(previewUrl);
            toast.error("Could not save receipt");
          }
        } else {
          URL.revokeObjectURL(previewUrl);
          toast.error("Could not process receipt");
        }
        busyRef.current = false;
        pump();
      }
    })();
  }, [refresh, userId]);

  const enqueue = (files: File[]) => {
    queueRef.current.push(...files);
    setQueuedCount(queueRef.current.length);
    pump();
  };

  const onSave = async (data: {
    merchantName?: string;
    merchantDate?: string;
    totalAmount?: number;
    taxAmount?: number;
  }) => {
    if (!review) return;
    setSaving(true);
    try {
      await createReceipt({ userId, imageUrl: review.previewUrl, ...data });
      refresh();
      toast.success("Receipt saved");
      setReview(null);
    } catch {
      toast.error("Could not save receipt");
    } finally {
      setSaving(false);
      busyRef.current = false;
      pump();
    }
  };

  const onDiscard = () => {
    if (review) URL.revokeObjectURL(review.previewUrl);
    setReview(null);
    busyRef.current = false;
    pump();
  };

  // ---- filters ----
  const [filter, setFilter] = React.useState<Filter>("all");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");

  const receipts = receiptsQuery.data ?? [];
  const filtered = receipts.filter((r) => {
    if (filter === "unattached" && r.isAttached) return false;
    if (filter === "attached" && !r.isAttached) return false;
    const d = r.merchantDate ?? r.createdAt.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  });

  // ---- selection ----
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createReport = useMutation({
    mutationFn: async () => {
      const chosen = receipts.filter((r) => selected.has(r.id));
      const types = typesQuery.data ?? (await getExpenseTypes());
      const other =
        types.find((t) => t.displayName === "Other Expenses") ??
        types.find((t) => !t.isMileage);
      const today = new Date().toISOString().slice(0, 10);
      const dates = chosen
        .map((r) => r.merchantDate)
        .filter((d): d is string => Boolean(d))
        .sort();
      const draft = await createDraft({
        reportName: `Receipts — ${formatDate(today)}`,
        submitterId: userId,
        paidToId: userId,
        periodFrom: dates[0] ?? today,
        periodTo: dates[dates.length - 1] ?? today,
      });
      const items: LineItemInput[] = chosen.map((r) => ({
        expenseDate: r.merchantDate ?? today,
        purposeOfTrip: "",
        description: r.merchantName ?? "Receipt",
        city: "",
        state: "",
        country: "",
        expenseTypeId: other?.id ?? "",
        amount: r.totalAmount ?? 0,
        receiptId: r.id,
      }));
      await replaceLineItems(draft.id, items);
      await Promise.all(chosen.map((r) => attachReceipt(draft.id, r.id)));
      return draft.id;
    },
    onSuccess: (id) => {
      refresh();
      router.push(`/reports/${id}/edit`);
    },
    onError: () => toast.error("Could not create report"),
  });

  const processingLabel = processing
    ? `Processing receipt: ${processing}${
        queuedCount > 0 ? ` (+${queuedCount} queued)` : ""
      }…`
    : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header>
        <h1>Receipt Gallery</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture receipts, review the scanned details, and build reports.
        </p>
      </header>

      <UploadZone onFiles={enqueue} processingLabel={processingLabel} />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unattached">Unattached</TabsTrigger>
            <TabsTrigger value="attached">Attached</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-auto"
            aria-label="From date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-auto"
            aria-label="To date"
          />
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              aria-label="Clear dates"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      {receiptsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          {receipts.length === 0
            ? "No receipts yet — upload one above to get started."
            : "No receipts match these filters."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 pb-20 lg:grid-cols-3">
          {filtered.map((r) => (
            <ReceiptCard
              key={r.id}
              receipt={r}
              selected={selected.has(r.id)}
              onToggle={() => toggle(r.id)}
            />
          ))}
        </div>
      )}

      {/* Multi-select action bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-40 mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur md:bottom-6">
          <span className="text-sm font-medium">
            {selected.size}{" "}
            {selected.size === 1 ? "receipt" : "receipts"} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
            <Button
              size="sm"
              disabled={createReport.isPending}
              onClick={() => createReport.mutate()}
            >
              {createReport.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FilePlus2 className="size-4" />
              )}
              Create New Report with Selected
            </Button>
          </div>
        </div>
      )}

      <OcrReviewModal
        item={review}
        saving={saving}
        onSave={onSave}
        onDiscard={onDiscard}
      />
    </div>
  );
}
