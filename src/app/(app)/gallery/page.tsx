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
import { AlertTriangle, Eye, FilePlus2, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import {
  createReportFromReceipts,
  getDelegatedPrincipals,
  getReceipts,
  getUsers,
  hardDeleteReceipts,
  restoreReceipts,
  trashReceipts,
} from "@/lib/data";
import { useSession } from "@/lib/auth/mock-session";
import { useSystemSettings } from "@/lib/use-system-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadZone } from "@/components/gallery/upload-zone";
import { ReceiptCard, TrashReceiptCard } from "@/components/gallery/receipt-card";
import { OcrReviewModal } from "@/components/gallery/ocr-review-modal";
import { useReceiptCapture } from "@/components/gallery/use-receipt-capture";

type Filter = "all" | "unattached" | "attached" | "trash";

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// ---- Trash confirm dialog ----

function TrashConfirmDialog({
  count,
  retentionDays,
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  count: number;
  retentionDays: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to Trash?</DialogTitle>
          <DialogDescription>
            {count === 1 ? "The receipt" : `${count} receipts`} will be kept
            for {retentionDays} days and can be restored from the Trash tab.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton>
          <Button onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Move to Trash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Hard delete confirm (typed DELETE) ----

function HardDeleteDialog({
  count,
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  count: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (!open) setTyped("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete Permanently?</DialogTitle>
          <DialogDescription>
            This will permanently delete{" "}
            {count === 1 ? "this receipt" : `${count} receipts`}. This cannot
            be undone. Type <strong>DELETE</strong> to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="DELETE"
          autoFocus
        />
        <DialogFooter showCloseButton>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={typed !== "DELETE" || busy}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Delete Permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Empty Trash confirm ----

function EmptyTrashDialog({
  count,
  open,
  onOpenChange,
  onConfirm,
  busy,
}: {
  count: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  const [typed, setTyped] = React.useState("");
  React.useEffect(() => {
    if (!open) setTyped("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Empty Trash?</DialogTitle>
          <DialogDescription>
            This will permanently delete all {count}{" "}
            {count === 1 ? "receipt" : "receipts"} in the trash. This cannot
            be undone. Type <strong>DELETE</strong> to confirm.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="DELETE"
          autoFocus
        />
        <DialogFooter showCloseButton>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={typed !== "DELETE" || busy}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Empty Trash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Main page ----

export default function GalleryPage() {
  const { user } = useSession();
  const sessionUserId = user.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const settingsQuery = useSystemSettings();
  const retentionDays = settingsQuery.data?.receiptTrashRetentionDays ?? 30;

  // Principals this user is an active delegate for.
  const principalsQuery = useQuery({
    queryKey: ["delegated-principals", sessionUserId],
    queryFn: () => getDelegatedPrincipals(sessionUserId),
  });
  const principals = principalsQuery.data ?? [];

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const nameById = new Map((usersQuery.data ?? []).map((u) => [u.id, u.name]));

  // ---- selected gallery owner ----
  const [ownerId, setOwnerId] = React.useState(sessionUserId);
  const isOwn = ownerId === sessionUserId;
  const ownerName = principals.find((p) => p.id === ownerId)?.name ?? user.name;

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const switchOwner = (id: string) => {
    setOwnerId(id);
    setSelected(new Set());
  };

  // ---- live receipts query ----
  const receiptsQuery = useQuery({
    queryKey: ["receipts", ownerId],
    queryFn: () => getReceipts({ userId: ownerId }, sessionUserId),
  });

  // ---- trashed receipts query ----
  const trashQuery = useQuery({
    queryKey: ["receipts-trash", ownerId],
    queryFn: () => getReceipts({ userId: ownerId, trashed: true }, sessionUserId),
  });

  const refresh = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["receipts", ownerId] });
    queryClient.invalidateQueries({ queryKey: ["receipts-trash", ownerId] });
  }, [queryClient, ownerId]);

  // ---- capture pipeline ----
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

  const trashedReceipts = trashQuery.data ?? [];

  // ---- selection ----
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ---- confirm dialogs ----
  // pendingTrash: ids to move to trash (single or bulk)
  const [pendingTrash, setPendingTrash] = React.useState<string[]>([]);
  // pendingHardDelete: ids to permanently delete
  const [pendingHardDelete, setPendingHardDelete] = React.useState<string[]>([]);
  const [emptyTrashOpen, setEmptyTrashOpen] = React.useState(false);

  // ---- mutations ----
  const trashMutation = useMutation({
    mutationFn: (ids: string[]) => trashReceipts(ids, sessionUserId),
    onSuccess: () => {
      toast.success("Moved to Trash");
      setPendingTrash([]);
      setSelected(new Set());
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const restoreMutation = useMutation({
    mutationFn: (ids: string[]) => restoreReceipts(ids),
    onSuccess: (_, ids) => {
      toast.success(ids.length === 1 ? "Receipt restored" : `${ids.length} receipts restored`);
      setSelected(new Set());
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => hardDeleteReceipts(ids),
    onSuccess: (_, ids) => {
      toast.success(ids.length === 1 ? "Receipt permanently deleted" : `${ids.length} receipts permanently deleted`);
      setPendingHardDelete([]);
      setEmptyTrashOpen(false);
      setSelected(new Set());
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
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

  // Compute expiry date for a trashed receipt
  const expiresOn = (deletedAt: string | null) => {
    const base = deletedAt ? new Date(deletedAt) : new Date();
    base.setDate(base.getDate() + retentionDays);
    return base;
  };

  const isTrashView = filter === "trash";

  // Selected IDs in trash view that are in the current trashed list
  const selectedTrashIds = [...selected].filter((id) =>
    trashedReceipts.some((r) => r.id === id)
  );
  const selectedLiveUnattachedIds = [...selected].filter((id) =>
    filtered.some((r) => r.id === id && !r.isAttached)
  );

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

      {!isTrashView && (
        <UploadZone onFiles={enqueue} processingLabel={processingLabel} />
      )}

      {/* Trash retention banner */}
      {isTrashView && trashedReceipts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            Items in Trash are kept for {retentionDays} days, then permanently
            deleted.
          </div>
          <button
            type="button"
            className="font-medium underline underline-offset-2 hover:no-underline"
            onClick={() => setEmptyTrashOpen(true)}
          >
            Empty Trash now
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={filter}
          onValueChange={(v) => {
            setFilter(v as Filter);
            setSelected(new Set());
          }}
          className="max-w-full overflow-x-auto"
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unattached">Unattached</TabsTrigger>
            <TabsTrigger value="attached">Attached</TabsTrigger>
            <TabsTrigger value="trash">
              Trash
              {trashedReceipts.length > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium leading-none text-destructive">
                  {trashedReceipts.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {!isTrashView && (
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
                onClick={() => { setDateFrom(""); setDateTo(""); }}
                aria-label="Clear dates"
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Grid — Live receipts */}
      {!isTrashView && (
        <>
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
                  onTrash={() => setPendingTrash([r.id])}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Grid — Trash */}
      {isTrashView && (
        <>
          {trashQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-72 w-full rounded-xl" />
              ))}
            </div>
          ) : trashedReceipts.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
              Trash is empty.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 pb-20 sm:grid-cols-2 md:grid-cols-3">
              {trashedReceipts.map((r) => (
                <TrashReceiptCard
                  key={r.id}
                  receipt={r}
                  deletedByName={nameById.get(r.deletedById ?? "") ?? ""}
                  expiresOn={expiresOn(r.deletedAt)}
                  selected={selected.has(r.id)}
                  onToggle={() => toggle(r.id)}
                  onRestore={() => restoreMutation.mutate([r.id])}
                  onHardDelete={() => setPendingHardDelete([r.id])}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Multi-select action bar — live view */}
      {selected.size > 0 && !isTrashView && (
        <div className="fixed inset-x-3 bottom-16 z-40 mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between md:inset-x-0 md:bottom-6">
          <span className="text-sm font-medium">
            {selected.size} {selected.size === 1 ? "receipt" : "receipts"} selected
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            {selectedLiveUnattachedIds.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPendingTrash(selectedLiveUnattachedIds)}
              >
                <Trash2 className="size-4" />
                Move to Trash ({selectedLiveUnattachedIds.length})
              </Button>
            )}
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

      {/* Multi-select action bar — trash view */}
      {selected.size > 0 && isTrashView && (
        <div className="fixed inset-x-3 bottom-16 z-40 mx-auto flex max-w-3xl flex-col gap-2 rounded-xl border border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between md:inset-x-0 md:bottom-6">
          <span className="text-sm font-medium">
            {selectedTrashIds.length} {selectedTrashIds.length === 1 ? "receipt" : "receipts"} selected
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={restoreMutation.isPending}
              onClick={() => restoreMutation.mutate(selectedTrashIds)}
            >
              {restoreMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Restore Selected ({selectedTrashIds.length})
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setPendingHardDelete(selectedTrashIds)}
            >
              Delete Permanently ({selectedTrashIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <TrashConfirmDialog
        count={pendingTrash.length}
        retentionDays={retentionDays}
        open={pendingTrash.length > 0}
        onOpenChange={(o) => !o && setPendingTrash([])}
        onConfirm={() => trashMutation.mutate(pendingTrash)}
        busy={trashMutation.isPending}
      />

      <HardDeleteDialog
        count={pendingHardDelete.length}
        open={pendingHardDelete.length > 0}
        onOpenChange={(o) => !o && setPendingHardDelete([])}
        onConfirm={() => hardDeleteMutation.mutate(pendingHardDelete)}
        busy={hardDeleteMutation.isPending}
      />

      <EmptyTrashDialog
        count={trashedReceipts.length}
        open={emptyTrashOpen}
        onOpenChange={setEmptyTrashOpen}
        onConfirm={() => hardDeleteMutation.mutate(trashedReceipts.map((r) => r.id))}
        busy={hardDeleteMutation.isPending}
      />

      <OcrReviewModal
        item={review}
        saving={saving}
        onSave={onSave}
        onDiscard={onDiscard}
      />
    </div>
  );
}
