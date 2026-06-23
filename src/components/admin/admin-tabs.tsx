"use client";

// Admin console: Users (role + manager), Delegates, Expense Types. All writes
// go through the mock data layer into the store.

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UserCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { SETTING_KEYS } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import {
  addApprovalGroupMember,
  createDelegate,
  createExpenseType,
  createUser,
  deleteDelegate,
  deleteUser,
  getApprovalGroups,
  getDelegates,
  getExpenseTypes,
  getUserDeletability,
  getUsers,
  removeApprovalGroupMemberById,
  setUserActive,
  updateExpenseType,
  updateSystemSetting,
  updateUser,
} from "@/lib/data";
import {
  systemSettingsKey,
  useSystemSettings,
} from "@/lib/use-system-settings";
import type {
  ApprovalGroupWithMembers,
  ExpenseType,
  User,
  UserRole,
} from "@/lib/types";
import { AnnouncementBannerView } from "@/components/announcement-banner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ROLES: UserRole[] = ["EMPLOYEE", "ADMIN", "ACCOUNTING"];
const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AdminTabs() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
      <header>
        <h1>Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Users, delegates, expense types, and system settings.
        </p>
      </header>
      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="delegates">Delegates</TabsTrigger>
          <TabsTrigger value="groups">Approval Groups</TabsTrigger>
          <TabsTrigger value="types">Expense Types</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="pt-4">
          <UsersTab />
        </TabsContent>
        <TabsContent value="delegates" className="pt-4">
          <DelegatesTab />
        </TabsContent>
        <TabsContent value="groups" className="pt-4">
          <ApprovalGroupsTab />
        </TabsContent>
        <TabsContent value="types" className="pt-4">
          <ExpenseTypesTab />
        </TabsContent>
        <TabsContent value="system" className="pt-4">
          <SystemTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------- Users ----------------

export function UsersTab() {
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
              <TableHead className="text-right">Auto Approval Threshold</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28" />
              <TableHead className="w-14" />
              <TableHead className="w-14" />
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
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {u.fastTrackThreshold > 0
                    ? formatCurrency(u.fastTrackThreshold)
                    : "—"}
                </TableCell>
                <TableCell>
                  <StatusIndicator active={u.isActive} />
                </TableCell>
                <TableCell className="w-28 p-1 text-center">
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
                </TableCell>
                <TableCell className="w-14 p-1 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditing(u)}
                  >
                    Edit
                  </Button>
                </TableCell>
                <TableCell className="w-14 p-1 text-center">
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

const AUTO_APPROVAL_TOOLTIP =
  "If 0, every report goes through the full approver chain. If > 0, reports below this amount skip Approvers #2 and #3 and go straight to Accounting and Executive review.";

/** Auto Approval Expense Threshold number input with explanatory help text. */
function FastTrackField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label
      className="flex flex-col gap-1 text-xs font-medium text-muted-foreground"
      title={AUTO_APPROVAL_TOOLTIP}
    >
      Auto Approval Expense Threshold ($)
      <Input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="font-normal">{AUTO_APPROVAL_TOOLTIP}</span>
    </label>
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
  const [role, setRole] = React.useState<UserRole>("EMPLOYEE");
  const [managerId, setManagerId] = React.useState("");
  const [fastTrack, setFastTrack] = React.useState("0");

  React.useEffect(() => {
    if (open) {
      // Reset the form each time the dialog opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail("");
      setName("");
      setDepartment("");
      setRole("EMPLOYEE");
      setManagerId("");
      setFastTrack("0");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () =>
      createUser({
        email,
        name,
        department,
        role,
        managerId: managerId || null,
        fastTrackThreshold: Number(fastTrack) || 0,
      }),
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
          <FastTrackField value={fastTrack} onChange={setFastTrack} />
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
  const [name, setName] = React.useState<string>("");
  const [department, setDepartment] = React.useState<string>("");
  const [role, setRole] = React.useState<UserRole>("EMPLOYEE");
  const [managerId, setManagerId] = React.useState<string>("");
  const [approver1Id, setApprover1Id] = React.useState<string>("");
  const [approver2Id, setApprover2Id] = React.useState<string>("");
  const [approver3Id, setApprover3Id] = React.useState<string>("");
  const [fastTrack, setFastTrack] = React.useState<string>("0");

  React.useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(user.name);
      setDepartment(user.department);
      setRole(user.role);
      setManagerId(user.managerId ?? "");
      setApprover1Id(user.approver1Id ?? "");
      setApprover2Id(user.approver2Id ?? "");
      setApprover3Id(user.approver3Id ?? "");
      setFastTrack(String(user.fastTrackThreshold ?? 0));
    }
  }, [user]);

  // Eligible approvers: active users other than the user being edited.
  const approverOptions = users.filter((u) => u.id !== user?.id);

  const mutation = useMutation({
    mutationFn: () =>
      updateUser(user!.id, {
        name: name.trim(),
        department: department.trim(),
        role,
        managerId: managerId || null,
        approver1Id: approver1Id || null,
        approver2Id: approver2Id || null,
        approver3Id: approver3Id || null,
        fastTrackThreshold: Number(fastTrack) || 0,
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
            Name
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Department
            <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
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
          <FastTrackField value={fastTrack} onChange={setFastTrack} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Delegates ----------------

export function DelegatesTab() {
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

// ---------------- Approval Groups ----------------

export function ApprovalGroupsTab() {
  const qc = useQueryClient();
  const groups = useQuery({
    queryKey: ["approval-groups"],
    queryFn: getApprovalGroups,
  });
  const users = useQuery({ queryKey: ["users"], queryFn: getUsers });
  const [removing, setRemoving] = React.useState<{
    memberId: string;
    name: string;
    groupName: string;
  } | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["approval-groups"] });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeApprovalGroupMemberById(memberId),
    onSuccess: () => {
      invalidate();
      toast.success("Member removed");
      setRemoving(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (groups.isLoading || users.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The Accounting and Executive approval groups are mandatory — they
        can&apos;t be renamed or deleted. Edit their membership below. Every
        report routes through both groups after the per-user approver chain.
      </p>
      {(groups.data ?? []).map((g) => (
        <GroupCard
          key={g.group.id}
          data={g}
          allUsers={users.data ?? []}
          onChanged={invalidate}
          onAskRemove={setRemoving}
        />
      ))}
      <Dialog
        open={!!removing}
        onOpenChange={(o) => !o && !removeMutation.isPending && setRemoving(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove member?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove{" "}
            <span className="font-medium text-foreground">{removing?.name}</span>{" "}
            from{" "}
            <span className="font-medium text-foreground">
              {removing?.groupName}
            </span>
            ? They will no longer be able to approve reports at that step.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoving(null)}
              disabled={removeMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removing && removeMutation.mutate(removing.memberId)}
              disabled={removeMutation.isPending}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupCard({
  data,
  allUsers,
  onChanged,
  onAskRemove,
}: {
  data: ApprovalGroupWithMembers;
  allUsers: User[];
  onChanged: () => void;
  onAskRemove: (m: { memberId: string; name: string; groupName: string }) => void;
}) {
  const [pickUserId, setPickUserId] = React.useState("");

  const memberUserIds = new Set(data.members.map((m) => m.userId));
  // Exclude inactive users and users already in this group.
  const addable = allUsers.filter(
    (u) => u.isActive && !memberUserIds.has(u.id)
  );
  const activeCount = data.members.filter((m) => m.isActive).length;

  const addMutation = useMutation({
    mutationFn: () => addApprovalGroupMember(data.group.id, pickUserId),
    onSuccess: () => {
      setPickUserId("");
      onChanged();
      toast.success("Member added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div>
        <h3 className="text-sm font-semibold">{data.group.name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Mandatory group · key {data.group.key}
        </p>
      </div>

      {activeCount === 0 && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          This group has no active members — reports will stall at this step.
          Add at least one member.
        </div>
      )}

      {data.members.length > 0 && (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border">
          {data.members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 px-3 py-2"
            >
              <span className="flex items-center gap-2 text-sm">
                {m.name}
                {!m.isActive && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Inactive
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Remove ${m.name} from ${data.group.name}`}
                onClick={() =>
                  onAskRemove({
                    memberId: m.id,
                    name: m.name,
                    groupName: data.group.name,
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
          Add member
          <select
            className={SELECT_CLASS}
            value={pickUserId}
            onChange={(e) => setPickUserId(e.target.value)}
          >
            <option value="">Select a user…</option>
            {addable.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          onClick={() => addMutation.mutate()}
          disabled={!pickUserId || addMutation.isPending}
        >
          <Plus className="size-4" />
          Add Member
        </Button>
      </div>
    </section>
  );
}

// ---------------- Expense Types ----------------

export function ExpenseTypesTab() {
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
              <TableHead>GL Code</TableHead>
              <TableHead>GL Name</TableHead>
              <TableHead>Mileage</TableHead>
              <TableHead className="text-right">Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(types.data ?? []).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.displayName}</TableCell>
                <TableCell className="tabular-nums">{t.glCode}</TableCell>
                <TableCell>{t.glName}</TableCell>
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
  const [glCode, setGlCode] = React.useState("");
  const [glName, setGlName] = React.useState("");
  const [isMileage, setIsMileage] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplayName(type?.displayName ?? "");
      setGlCode(type?.glCode ?? "");
      setGlName(type?.glName ?? "");
      setIsMileage(type?.isMileage ?? false);
    }
  }, [open, type]);

  const mutation = useMutation({
    mutationFn: () =>
      isNew
        ? createExpenseType({ displayName, glCode, glName, isMileage })
        : updateExpenseType(type!.id, { displayName, glCode, glName, isMileage }),
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
            GL Code
            <Input
              value={glCode}
              onChange={(e) => setGlCode(e.target.value)}
              placeholder="MR5100501000"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            GL Name
            <Input
              value={glName}
              onChange={(e) => setGlName(e.target.value)}
              placeholder="Business Travel"
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

// ---------------- System ----------------

export function SystemTab() {
  const qc = useQueryClient();
  const settings = useSystemSettings();
  const current = settings.data;

  const [editingVersion, setEditingVersion] = React.useState(false);
  const [versionDraft, setVersionDraft] = React.useState("");
  const [messageDraft, setMessageDraft] = React.useState("");
  const [rateDraft, setRateDraft] = React.useState("");
  const [rateError, setRateError] = React.useState("");
  const [trashDraft, setTrashDraft] = React.useState("");
  const [trashError, setTrashError] = React.useState("");
  // Seed the local drafts from the fetched settings once they arrive.
  const seededRef = React.useRef(false);
  React.useEffect(() => {
    if (current && !seededRef.current) {
      seededRef.current = true;
      setVersionDraft(current.appVersion);
      setMessageDraft(current.announcementMessage);
      setRateDraft(String(current.mileageRate));
      setTrashDraft(String(current.receiptTrashRetentionDays));
    }
  }, [current]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: systemSettingsKey });
  const onError = (e: unknown) =>
    toast.error(e instanceof Error ? e.message : "Failed");

  const saveVersion = useMutation({
    mutationFn: () =>
      updateSystemSetting(SETTING_KEYS.appVersion, versionDraft.trim()),
    onSuccess: () => {
      invalidate();
      setEditingVersion(false);
      toast.success("Version updated");
    },
    onError,
  });

  const publish = useMutation({
    mutationFn: () =>
      updateSystemSetting(SETTING_KEYS.announcement, messageDraft),
    onSuccess: () => {
      invalidate();
      toast.success("Announcement published");
    },
    onError,
  });

  const clearAnnouncement = useMutation({
    mutationFn: () => updateSystemSetting(SETTING_KEYS.announcement, ""),
    onSuccess: () => {
      setMessageDraft("");
      invalidate();
      toast.success("Announcement cleared");
    },
    onError,
  });

  const saveRate = useMutation({
    mutationFn: () =>
      updateSystemSetting(SETTING_KEYS.mileageRate, rateDraft.trim()),
    onSuccess: () => {
      invalidate();
      toast.success("Mileage rate updated");
    },
    onError,
  });

  const saveTrash = useMutation({
    mutationFn: () =>
      updateSystemSetting(SETTING_KEYS.receiptTrashRetentionDays, trashDraft.trim()),
    onSuccess: () => {
      invalidate();
      toast.success("Trash retention updated");
    },
    onError,
  });

  function validateRate(raw: string): string {
    const n = parseFloat(raw);
    if (!raw.trim() || isNaN(n)) return "Enter a number (e.g. 0.725)";
    if (n <= 0) return "Rate must be greater than zero";
    if (!/^\d*\.?\d{0,4}$/.test(raw.trim())) return "Up to 4 decimal places";
    return "";
  }

  function handleRateChange(v: string) {
    setRateDraft(v);
    setRateError(validateRate(v));
  }

  function validateTrashDays(raw: string): string {
    const n = parseInt(raw.trim(), 10);
    if (!raw.trim() || isNaN(n)) return "Enter a whole number";
    if (n < 1) return "Must be at least 1 day";
    if (n > 365) return "Cannot exceed 365 days";
    return "";
  }

  function handleTrashChange(v: string) {
    setTrashDraft(v);
    setTrashError(validateTrashDays(v));
  }

  if (!current) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    );
  }

  const busy = publish.isPending || clearAnnouncement.isPending;

  return (
    <div className="flex flex-col gap-4">
      {/* Version Number */}
      <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Version Number</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shown in the sidebar footer for all users.
          </p>
        </div>
        {editingVersion ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Version
              <Input
                value={versionDraft}
                onChange={(e) => setVersionDraft(e.target.value)}
                placeholder="1.2.0"
                className="w-40"
              />
            </label>
            <Button
              onClick={() => saveVersion.mutate()}
              disabled={saveVersion.isPending || !versionDraft.trim()}
            >
              Save
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setEditingVersion(false);
                setVersionDraft(current.appVersion);
              }}
              disabled={saveVersion.isPending}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-sm tabular-nums">
              v{current.appVersion}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVersionDraft(current.appVersion);
                setEditingVersion(true);
              }}
            >
              Edit
            </Button>
          </div>
        )}
      </section>

      {/* Mileage Rate */}
      <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Mileage Rate</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            USD per mile applied to new mileage line items. Existing line items
            are not retroactively recalculated.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Rate ($ / mile)
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.0001"
                min="0.0001"
                value={rateDraft}
                onChange={(e) => handleRateChange(e.target.value)}
                className="w-32"
                placeholder="0.7250"
              />
            </div>
            {rateError && (
              <span className="text-xs text-destructive">{rateError}</span>
            )}
          </label>
          <Button
            onClick={() => {
              const err = validateRate(rateDraft);
              if (err) { setRateError(err); return; }
              saveRate.mutate();
            }}
            disabled={saveRate.isPending || !!rateError || !rateDraft.trim()}
          >
            Save
          </Button>
          {current.mileageRateUpdatedAt && (
            <span className="self-center text-xs text-muted-foreground">
              Effective {new Date(current.mileageRateUpdatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </section>

      {/* Receipt Trash Retention */}
      <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Receipt Trash Retention</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How many days trashed receipts are kept before automatic permanent
            deletion. Applies to new trash actions going forward (1–365 days).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Retention (days)
            <Input
              type="number"
              step="1"
              min="1"
              max="365"
              value={trashDraft}
              onChange={(e) => handleTrashChange(e.target.value)}
              className="w-28"
              placeholder="30"
            />
            {trashError && (
              <span className="text-xs text-destructive">{trashError}</span>
            )}
          </label>
          <Button
            onClick={() => {
              const err = validateTrashDays(trashDraft);
              if (err) { setTrashError(err); return; }
              saveTrash.mutate();
            }}
            disabled={saveTrash.isPending || !!trashError || !trashDraft.trim()}
          >
            Save
          </Button>
        </div>
      </section>

      {/* Announcement Banner */}
      <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <div>
          <h3 className="text-sm font-semibold">Announcement Banner</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shown at the top of every page. Supports <code>**bold**</code>. An
            empty message hides the banner for everyone.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Message
          <Textarea
            value={messageDraft}
            onChange={(e) => setMessageDraft(e.target.value)}
            rows={3}
            placeholder="e.g. **Heads up:** Expense Hub maintenance this Saturday 8–10pm ET."
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Preview
          </span>
          {messageDraft.trim() ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <AnnouncementBannerView message={messageDraft} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
              No announcement — the banner is hidden for users.
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={() => publish.mutate()} disabled={busy}>
            Publish
          </Button>
          <Button
            variant="outline"
            onClick={() => clearAnnouncement.mutate()}
            disabled={busy || !current.announcementMessage}
          >
            Clear
          </Button>
        </div>
      </section>
    </div>
  );
}
