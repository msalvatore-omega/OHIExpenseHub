"use client";

// Admin console: Users (role + manager), Delegates, Expense Types. All writes
// go through the mock data layer into the store.

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createDelegate,
  createExpenseType,
  deleteDelegate,
  getDelegates,
  getExpenseTypes,
  getUsers,
  updateExpenseType,
  updateUser,
} from "@/lib/data";
import type { ExpenseType, User, UserRole } from "@/lib/types";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLES: UserRole[] = ["SUBMITTER", "APPROVER", "ADMIN", "ACCOUNTING"];
const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AdminTabs() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header>
        <h1>Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Users, delegates, and expense types.
        </p>
      </header>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="delegates">Delegates</TabsTrigger>
          <TabsTrigger value="types">Expense Types</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="pt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="delegates" className="pt-4">
          <DelegatesTab />
        </TabsContent>
        <TabsContent value="types" className="pt-4">
          <ExpenseTypesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- Users ----------------

function UsersTab() {
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const [editing, setEditing] = React.useState<User | null>(null);

  const nameById = new Map((users.data ?? []).map((u) => [u.id, u.name]));

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(users.data ?? []).map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.department}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>
                  {u.managerId ? nameById.get(u.managerId) ?? "—" : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <EditUserDialog
        user={editing}
        users={users.data ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["users"] });
          setEditing(null);
        }}
      />
    </>
  );
}

function EditUserDialog({
  user,
  users,
  onClose,
  onSaved,
}: {
  user: User | null;
  users: User[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [role, setRole] = React.useState<UserRole>("SUBMITTER");
  const [managerId, setManagerId] = React.useState<string>("");

  React.useEffect(() => {
    if (user) {
      setRole(user.role);
      setManagerId(user.managerId ?? "");
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: () =>
      updateUser(user!.id, { role, managerId: managerId || null }),
    onSuccess: () => {
      toast.success("User updated");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user?.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Role
            <select
              className={SELECT_CLASS}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Manager
            <select
              className={SELECT_CLASS}
              value={managerId}
              onChange={(e) => setManagerId(e.target.value)}
            >
              <option value="">— None —</option>
              {users
                .filter((u) => u.id !== user?.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Delegates ----------------

function DelegatesTab() {
  const qc = useQueryClient();
  const delegates = useQuery({ queryKey: ["delegates"], queryFn: getDelegates });
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const nameById = new Map((users.data ?? []).map((u) => [u.id, u.name]));

  const [delegateId, setDelegateId] = React.useState("");
  const [principalId, setPrincipalId] = React.useState("");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["delegates"] });

  const addMutation = useMutation({
    mutationFn: () => createDelegate({ delegateId, principalId }),
    onSuccess: () => {
      toast.success("Delegate added");
      setDelegateId("");
      setPrincipalId("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteDelegate(id),
    onSuccess: () => {
      toast.success("Delegate removed");
      invalidate();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Delegate
          <select
            className={SELECT_CLASS}
            value={delegateId}
            onChange={(e) => setDelegateId(e.target.value)}
          >
            <option value="">Select…</option>
            {(users.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Acts for (principal)
          <select
            className={SELECT_CLASS}
            value={principalId}
            onChange={(e) => setPrincipalId(e.target.value)}
          >
            <option value="">Select…</option>
            {(users.data ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() => addMutation.mutate()}
          disabled={!delegateId || !principalId || delegateId === principalId}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Delegate</TableHead>
              <TableHead>Acts For</TableHead>
              <TableHead>Active</TableHead>
              <TableHead className="text-right">Remove</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(delegates.data ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">
                  No delegates.
                </TableCell>
              </TableRow>
            ) : (
              (delegates.data ?? []).map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    {nameById.get(d.delegateId) ?? "—"}
                  </TableCell>
                  <TableCell>{nameById.get(d.principalId) ?? "—"}</TableCell>
                  <TableCell>{d.isActive ? "Yes" : "No"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeMutation.mutate(d.id)}
                      aria-label="Remove delegate"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ---------------- Expense Types ----------------

function ExpenseTypesTab() {
  const qc = useQueryClient();
  const types = useQuery({ queryKey: ["expense-types"], queryFn: getExpenseTypes });
  const [editing, setEditing] = React.useState<ExpenseType | null>(null);
  const [adding, setAdding] = React.useState(false);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["expense-types"] });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-4" />
          Add Type
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display Name</TableHead>
              <TableHead>Accounting Code</TableHead>
              <TableHead>Mileage</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(types.data ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.displayName}</TableCell>
                <TableCell className="tabular-nums">{t.accountingCode}</TableCell>
                <TableCell>{t.isMileage ? "Yes" : "No"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" onClick={() => setEditing(t)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ExpenseTypeDialog
        type={editing}
        open={!!editing || adding}
        isNew={adding}
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
    </div>
  );
}

function ExpenseTypeDialog({
  type,
  open,
  isNew,
  onClose,
  onSaved,
}: {
  type: ExpenseType | null;
  open: boolean;
  isNew: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = React.useState("");
  const [accountingCode, setAccountingCode] = React.useState("");
  const [isMileage, setIsMileage] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setDisplayName(type?.displayName ?? "");
      setAccountingCode(type?.accountingCode ?? "");
      setIsMileage(type?.isMileage ?? false);
    }
  }, [open, type]);

  const mutation = useMutation({
    mutationFn: () =>
      isNew
        ? createExpenseType({ displayName, accountingCode, isMileage })
        : updateExpenseType(type!.id, { displayName, accountingCode, isMileage }),
    onSuccess: () => {
      toast.success(isNew ? "Type added" : "Type updated");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add expense type" : "Edit expense type"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Display Name
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Accounting Code
            <Input
              value={accountingCode}
              onChange={(e) => setAccountingCode(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isMileage}
              onCheckedChange={(v) => setIsMileage(v === true)}
            />
            Mileage type (amount = miles × rate)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !displayName.trim()}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
