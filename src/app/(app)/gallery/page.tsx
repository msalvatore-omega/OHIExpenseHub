"use client";

// Receipt Gallery + capture pipeline.
// A delegate can switch between their own gallery and any principal they're an
// active delegate for ("Viewing" selector). The selected owner scopes the grid,
// tabs, date filter, uploads (userId = owner, uploadedById = you), and
// Create-Report. Access is enforced server-side in the data layer, not by the
// selector alone.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FilePlus2, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import {
  createReportFromReceipts,
  getDelegatedPrincipals,
  getReceipts,
} from "@/lib/data";
import { useSession } from "@/lib/auth/mock-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadZone } from "@/components/gallery/upload-zone";
import { ReceiptCard } from "@/components/gallery/receipt-card";
import { OcrReviewModal } from "@/components/gallery/ocr-review-modal";
import { useReceiptCapture } from "@/components/gallery/use-receipt-capture";

type Filter = "all" | "unattached" | "attached";

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default function GalleryPage() {
  const { user } = useSession();
  const sessionUserId = user.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  // Principals this user is an active delegate for (the selectable galleries).
  const principalsQuery = useQuery({
    queryKey: ["delegated-principals", sessionUserId],
    queryFn: () => getDelegatedPrincipals(sessionUserId),
  });
  const principals = principalsQuery.data ?? [];

  // ---- selected gallery owner ----
  const [ownerId, setOwnerId] = React.useState(sessionUserId);
  const isOwn = ownerId === sessionUserId;
  const ownerName =
    principals.find((p) => p.id === ownerId)?.name ?? user.name;

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const switchOwner = (id: string) => {
    setOwnerId(id);
    setSelected(new Set());
  };

  const receiptsQuery = useQuery({
    queryKey: ["receipts", ownerId],
    queryFn: () => getReceipts({ userId: ownerId }, sessionUserId),
  });

  const refresh = React.useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["receipts", ownerId] }),
    [queryClient, ownerId]
  );

  // ---- capture pipeline (owner = selected gallery, uploader = you) ----
  const { enqueue, review, saving, processingLabel, onSave, onDiscard } =
    useReceiptCapture({
      userId: ownerId,
      uploadedById: sessionUserId,
      onSaved: refresh,
      savedMessage: isOwn
        ? "Receipt saved"
        : `Receipt added to ${ownerName}'s gallery`,
    });

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
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createReport = useMutation({
    mutationFn: () =>
      createReportFromReceipts({
        requesterId: sessionUserId,
        ownerId,
        receiptIds: [...selected],
      }),
    onSuccess: (id) => {
      refresh();
      router.push(`/reports/${id}/edit`);
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Could not create report"),
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 overflow-x-hidden px-3 py-8 sm:px-4 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1>Receipt Gallery</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture receipts, review the scanned details, and build reports.
          </p>
        </div>

        {principals.length > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Viewing</span>
            <select
              className={SELECT_CLASS}
              value={ownerId}
              onChange={(e) => switchOwner(e.target.value)}
            >
              <option value={sessionUserId}>My Gallery</option>
              {principals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}&apos;s Gallery
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {!isOwn && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <Eye className="size-4 text-muted-foreground" />
          Viewing <span className="font-medium">{ownerName}</span>&apos;s receipts
        </div>
      )}

      <UploadZone onFiles={enqueue} processingLabel={processingLabel} />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          className="max-w-full overflow-x-auto"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unattached">Unattached</TabsTrigger>
            <TabsTrigger value="attached">Attached</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-auto min-w-0"
            aria-label="From date"
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-auto min-w-0"
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      ) : receiptsQuery.isError ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-destructive/40 text-sm text-destructive">
          You do not have access to this gallery.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
          {receipts.length === 0
            ? "No receipts yet — upload one above to get started."
            : "No receipts match these filters."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 pb-20 sm:grid-cols-2 md:grid-cols-3">
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
        <div className="fixed inset-x-3 bottom-16 z-40 mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between md:inset-x-0 md:bottom-6">
          <span className="text-sm font-medium">
            {selected.size}{" "}
            {selected.size === 1 ? "receipt" : "receipts"} selected
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
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
              className="h-auto max-w-full whitespace-normal text-center"
            >
              {createReport.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FilePlus2 className="size-4" />
              )}
              {isOwn
                ? "Create New Report with Selected"
                : `Create Report for ${ownerName}`}
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
