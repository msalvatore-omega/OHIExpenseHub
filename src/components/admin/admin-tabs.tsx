"use client";

// Admin console: Users (role + manager), Delegates, Expense Types. All writes
// go through the mock data layer into the store.

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  createDelegate,
  createExpenseType,
  createUser,
  deleteDelegate,
  deleteUser,
  getDelegates,
  getExpenseTypes,
  getUserDeletability,
  getUsers,
  setUserActive,
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
  const [adding, setAdding] = React.useState(false);
  const [deleting, setDeleting] = React.useState<User | null>(null);
  const [reactivating, setReactivating] = React.useState<User | null>(null);

  const all = users.data ?? [];
  const activeUsers = all.filter((u) => u.isActive);
  const nameById = new Map(all.map((u) => [u.id, u.name]));

  // "#1 → #2 → #3" of configured approvers, by name (skips unset steps).
  const approverChainLabel = (u: User) => {
    const names = [u.approver1Id, u.approver2Id, u.approver3Id]
      .filter((id): id is string => Boolean(id))
      .map((id) => nameById.get(id) ?? "—");
    return names.length ? names.join(" → ") : "—";
  };

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setAdding(true)}>
          <UserPlus className="size-4" />
          Add User
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Manager</TableHead>
              <TableHead>Approvers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {all.map((u) => (
              <TableRow key={u.id} className={cn(!u.isActive && "opacity-60")}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.department}</TableCell>
                <TableCell>{u.role}</TableCell>
                <TableCell>
                  {u.managerId ? nameById.get(u.managerId) ?? "—" : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {approverChainLabel(u)}
                </TableCell>
                <TableCell>
                  <StatusIndicator active={u.isActive} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {!u.isActive && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReactivating(u)}
                      >
                        <UserCheck className="size-4" />
                        Reactivate
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(u)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(u)}
                      aria-label={
                        u.isActive
                          ? `Deactivate ${u.name}`
                          : `Delete ${u.name}`
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditUserDialog
        user={editing}
        users={activeUsers}
        onClose={() => setEditing(null)}
        onSaved={() => {
          invalidate();
          setEditing(null);
        }}
      />
      <AddUserDialog
        open={adding}
        users={activeUsers}
        onClose={() => setAdding(false)}
        onSaved={() => {
          invalidate();
          setAdding(false);
        }}
      />
      <DeleteUserDialog
        user={deleting}
        onClose={() => setDeleting(null)}
        onDone={() => {
          invalidate();
          setDeleting(null);
        }}
      />
      <ReactivateUserDialog
        user={reactivating}
        onClose={() => setReactivating(null)}
        onDone={() => {
          invalidate();
          setReactivating(null);
        }}
      />
    </div>
  );
}

function StatusIndicator({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
        active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          active ? "bg-success" : "bg-muted-foreground"
        )}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function AddUserDialog({
  open,
  users,
  onClose,
  onSaved,
}: {
  open: boolean;
  users: User[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("SUBMITTER");
  const [managerId, setManagerId] = React.useState("");

  React.useEffect(() => {
    if (open) {
      // Reset the form each time the dialog opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail("");
      setName("");
      setDepartment("");
      setRole("SUBMITTER");
      setManagerId("");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createUser({ email, name, department, role, managerId: managerId || null }),
    onSuccess: () => {
      toast.success("User created");
      onSaved();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Email <span className="text-destructive">*</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@ohi.example.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Name
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Department
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </label>
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
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            The account links to Azure AD on the user&apos;s first sign-in
            (matched by email).
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !email.trim()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({
  user,
  onClose,
  onDone,
}: {
  user: User | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const usage = useQuery({
    queryKey: ["user-deletability", user?.id],
    queryFn: () => getUserDeletability(user!.id),
    enabled: !!user,
  });
  const canHardDelete = usage.data?.canHardDelete ?? false;
  const active = user?.isActive ?? true;

  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Failed");

  const deactivate = useMutation({
    mutationFn: () => setUserActive(user!.id, false),
    onSuccess: () => {
      toast.success("User deactivated");
      onDone();
    },
    onError,
  });
  const reactivate = useMutation({
    mutationFn: () => setUserActive(user!.id, true),
    onSuccess: () => {
      toast.success("User reactivated");
      onDone();
    },
    onError,
  });
  const hardDelete = useMutation({
    mutationFn: () => deleteUser(user!.id),
    onSuccess: () => {
      toast.success("User deleted");
      onDone();
    },
    onError,
  });

  const busy =
    deactivate.isPending || reactivate.isPending || hardDelete.isPending;

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {active ? `Deactivate ${user?.name}?` : `Delete ${user?.name}?`}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          {active ? (
            <p>
              Deactivating prevents{" "}
              <span className="font-medium text-foreground">{user?.name}</span>{" "}
              from signing in or being selected, while keeping their historical
              reports and approval history intact.
            </p>
          ) : (
            <p>
              <span className="font-medium text-foreground">{user?.name}</span>{" "}
              is already inactive. You can reactivate them, or permanently delete
              if nothing references them.
            </p>
          )}
          {usage.isLoading ? (
            <p className="text-xs">Checking related records…</p>
          ) : canHardDelete ? (
            <p className="text-xs">
              No reports, approvals, or delegate records reference this user — a
              permanent delete is available.
            </p>
          ) : (
            <p className="text-xs">
              This user is referenced by existing records, so a permanent delete
              isn&apos;t available — deactivate instead.
            </p>
          )}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {active ? (
            <Button onClick={() => deactivate.mutate()} disabled={busy}>
              Deactivate
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => reactivate.mutate()}
              disabled={busy}
            >
              Reactivate
            </Button>
          )}
          <Button
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={busy || usage.isLoading || !canHardDelete}
            onClick={() => hardDelete.mutate()}
          >
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Confirm dialog for reactivating an inactive user (inverse of deactivate). */
function ReactivateUserDialog({
  user,
  onClose,
  onDone,
}: {
  user: User | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const reactivate = useMutation({
    mutationFn: () => setUserActive(user!.id, true),
    onSuccess: () => {
      toast.success("User reactivated");
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reactivate {user?.name}?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{user?.name}</span> will
          be able to sign in again and will reappear in all people pickers
          (manager, approver, On Behalf Of, and delegate).
        </p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={reactivate.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => reactivate.mutate()}
            disabled={reactivate.isPending}
          >
            <UserCheck className="size-4" />
            Reactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A clearable people picker for a single approver-chain slot. */
function ApproverPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: User[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        className={SELECT_CLASS}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— None —</option>
        {options.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </label>
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
  const [approver1Id, setApprover1Id] = React.useState<string>("");
  const [approver2Id, setApprover2Id] = React.useState<string>("");
  const [approver3Id, setApprover3Id] = React.useState<string>("");

  React.useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRole(user.role);
      setManagerId(user.managerId ?? "");
      setApprover1Id(user.approver1Id ?? "");
      setApprover2Id(user.approver2Id ?? "");
      setApprover3Id(user.approver3Id ?? "");
    }
  }, [user]);

  // Eligible approvers: active users other than the user being edited.
  const approverOptions = users.filter((u) => u.id !== user?.id);

  const mutation = useMutation({
    mutationFn: () =>
      updateUser(user!.id, {
        role,
        managerId: managerId || null,
        approver1Id: approver1Id || null,
        approver2Id: approver2Id || null,
        approver3Id: approver3Id || null,
      }),
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
              {approverOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Approval chain
            </p>
            <ApproverPicker
              label="Approver #1"
              value={approver1Id}
              options={approverOptions}
              onChange={setApprover1Id}
            />
            <ApproverPicker
              label="Approver #2 (optional)"
              value={approver2Id}
              options={approverOptions}
              onChange={setApprover2Id}
            />
            <ApproverPicker
              label="Approver #3 (optional)"
              value={approver3Id}
              options={approverOptions}
              onChange={setApprover3Id}
            />
            <p className="text-xs text-muted-foreground">
              Approvals route through these in order, skipping any left empty. If
              none are set, routing falls back to the user&apos;s manager.
            </p>
          </div>
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
  // Only active users can be picked as a delegate or principal.
  const selectableUsers = (users.data ?? []).filter((u) => u.isActive);

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
            {selectableUsers.map((u) => (
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
            {selectableUsers.map((u) => (
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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
