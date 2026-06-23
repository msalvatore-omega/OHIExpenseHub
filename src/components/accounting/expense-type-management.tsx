"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useSession } from "@/lib/auth/mock-session";
import {
  createExpenseType,
  deleteExpenseType,
  getExpenseTypeUsageCounts,
  getExpenseTypes,
  updateExpenseType,
} from "@/lib/data";
import type { ExpenseType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---- Form state ----

interface FormState {
  displayName: string;
  glCode: string;
  glName: string;
  isMileage: boolean;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  displayName: "",
  glCode: "",
  glName: "",
  isMileage: false,
  isActive: true,
};

// ---- Main component ----

export function ExpenseTypeManagement() {
  const { user } = useSession();
  const qc = useQueryClient();

  const typesQuery = useQuery({
    queryKey: ["expense-types"],
    queryFn: getExpenseTypes,
  });
  const usageQuery = useQuery({
    queryKey: ["expense-type-usage"],
    queryFn: getExpenseTypeUsageCounts,
  });

  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<ExpenseType | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<ExpenseType | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["expense-types"] });
    qc.invalidateQueries({ queryKey: ["expense-type-usage"] });
    qc.invalidateQueries({ queryKey: ["active-expense-types"] });
  };

  const types = typesQuery.data ?? [];
  const usage = usageQuery.data ?? {};

  const filtered = React.useMemo(() => {
    if (!search.trim()) return types;
    const q = search.toLowerCase();
    return types.filter(
      (t) =>
        t.displayName.toLowerCase().includes(q) ||
        t.glCode.toLowerCase().includes(q) ||
        t.glName.toLowerCase().includes(q)
    );
  }, [types, search]);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, GL code, or GL name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add Expense Type
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display Name</TableHead>
              <TableHead>GL Code</TableHead>
              <TableHead>GL Name</TableHead>
              <TableHead>Mileage?</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {typesQuery.isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  {search
                    ? "No expense types match your search."
                    : "No expense types configured."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => {
                const count = usage[t.id] ?? 0;
                const canDelete = count === 0;
                return (
                  <TableRow
                    key={t.id}
                    className={!t.isActive ? "opacity-60" : undefined}
                  >
                    <TableCell className="font-medium">{t.displayName}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {t.glCode || "—"}
                    </TableCell>
                    <TableCell>{t.glName}</TableCell>
                    <TableCell>
                      {t.isMileage ? (
                        <Badge variant="secondary">Yes</Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {t.isActive ? (
                        <Badge className="border-0 bg-success/10 text-success">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${t.displayName}`}
                          onClick={() => setEditing(t)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <span
                          title={
                            canDelete
                              ? undefined
                              : `In use by ${count} line item${count === 1 ? "" : "s"} — deactivate instead`
                          }
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${t.displayName}`}
                            disabled={!canDelete}
                            onClick={() => setDeleting(t)}
                            className="text-destructive hover:text-destructive disabled:pointer-events-none"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit dialog */}
      <ExpenseTypeDialog
        type={editing}
        open={!!editing || adding}
        isNew={adding}
        actorId={user.id}
        allTypes={types}
        onClose={() => {
          setEditing(null);
          setAdding(false);
        }}
        onSaved={() => {
          invalidate();
          setEditing(null);
          setAdding(false);
        }}
      />

      {/* Delete confirmation dialog */}
      {deleting && (
        <DeleteConfirmDialog
          type={deleting}
          actorId={user.id}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            invalidate();
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}

// ---- Add / Edit dialog ----

function ExpenseTypeDialog({
  type,
  open,
  isNew,
  actorId,
  allTypes,
  onClose,
  onSaved,
}: {
  type: ExpenseType | null;
  open: boolean;
  isNew: boolean;
  actorId: string;
  allTypes: ExpenseType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [nameError, setNameError] = React.useState("");
  const [mileageConflict, setMileageConflict] = React.useState<ExpenseType | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm(
        type
          ? {
              displayName: type.displayName,
              glCode: type.glCode,
              glName: type.glName,
              isMileage: type.isMileage,
              isActive: type.isActive,
            }
          : EMPTY_FORM
      );
      setNameError("");
      setMileageConflict(null);
    }
  }, [open, type]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const handleMileageChange = (checked: boolean) => {
    set("isMileage", checked);
    if (checked) {
      const conflict = allTypes.find((t) => t.isMileage && t.id !== type?.id);
      setMileageConflict(conflict ?? null);
    } else {
      setMileageConflict(null);
    }
  };

  const mutation = useMutation({
    mutationFn: () => {
      const input = {
        displayName: form.displayName.trim(),
        glCode: form.glCode.trim(),
        glName: form.glName.trim(),
        isMileage: form.isMileage,
        isActive: form.isActive,
      };
      return isNew
        ? createExpenseType(input, actorId)
        : updateExpenseType(type!.id, input, actorId);
    },
    onSuccess: () => {
      toast.success(isNew ? "Expense type added." : "Expense type updated.");
      onSaved();
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Failed to save.";
      if (msg.toLowerCase().includes("already exists")) {
        setNameError(msg);
      } else {
        toast.error(msg);
      }
    },
  });

  const canSave =
    form.displayName.trim().length > 0 && form.glName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isNew ? "Add Expense Type" : "Edit Expense Type"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Display Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.displayName}
              onChange={(e) => {
                set("displayName", e.target.value);
                setNameError("");
              }}
              placeholder="e.g. Business Travel"
            />
            {nameError && (
              <p className="text-xs text-destructive">{nameError}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              GL Code
            </label>
            <Input
              value={form.glCode}
              onChange={(e) => set("glCode", e.target.value)}
              placeholder="MR5100501000"
              className="font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              GL Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={form.glName}
              onChange={(e) => set("glName", e.target.value)}
              placeholder="e.g. Business Travel"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={form.isMileage}
              onCheckedChange={(v) => handleMileageChange(v === true)}
            />
            Mileage type (amount = miles × rate)
          </label>
          {mileageConflict && (
            <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              <strong>"{mileageConflict.displayName}"</strong> is currently the
              mileage type. Saving will unset it and make this the new mileage
              type.
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox
              checked={form.isActive}
              onCheckedChange={(v) => set("isActive", v === true)}
            />
            Active (visible in expense dropdowns)
          </label>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!canSave || mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Delete confirmation dialog ----

function DeleteConfirmDialog({
  type,
  actorId,
  onClose,
  onDeleted,
}: {
  type: ExpenseType;
  actorId: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [input, setInput] = React.useState("");

  const mutation = useMutation({
    mutationFn: () => deleteExpenseType(type.id, actorId),
    onSuccess: () => {
      toast.success(`"${type.displayName}" deleted.`);
      onDeleted();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Failed to delete."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{type.displayName}"?</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-1 text-sm">
          <p className="text-muted-foreground">
            This action cannot be undone. Type{" "}
            <strong className="font-mono text-foreground">DELETE</strong> to
            confirm.
          </p>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type DELETE to confirm"
            className="font-mono"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={input !== "DELETE" || mutation.isPending}
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
