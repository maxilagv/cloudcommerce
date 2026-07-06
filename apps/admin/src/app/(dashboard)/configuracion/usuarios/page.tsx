"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminRole, type AdminUserSummary } from "@cloudcommerce/types";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogClose,
  DialogContent,
  Select,
  type ColumnDef,
  useToast,
} from "@cloudcommerce/ui";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/format";

type ActiveFilter = "all" | "active" | "inactive";
type RoleFilter = AdminRole | "all";
type InviteDraft = { email: string; fullName: string; role: AdminRole; reason: string };
type RoleDraft = { user: AdminUserSummary; role: AdminRole; reason: string };
type DeactivateDraft = { user: AdminUserSummary; reason: string };

const ROLE_LABELS: Record<AdminRole, string> = {
  [AdminRole.OWNER]: "Owner",
  [AdminRole.ADMIN]: "Admin",
  [AdminRole.CATALOG_MANAGER]: "Catalogo",
  [AdminRole.FINANCE]: "Finanzas",
  [AdminRole.SUPPORT]: "Soporte",
};

const ROLE_FILTERS: { label: string; value: RoleFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "Owner", value: AdminRole.OWNER },
  { label: "Admin", value: AdminRole.ADMIN },
  { label: "Catalogo", value: AdminRole.CATALOG_MANAGER },
  { label: "Finanzas", value: AdminRole.FINANCE },
  { label: "Soporte", value: AdminRole.SUPPORT },
];

const ACTIVE_FILTERS: { label: string; value: ActiveFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "Activos", value: "active" },
  { label: "Inactivos", value: "inactive" },
];

function roleTone(role: AdminRole): "success" | "info" | "warning" | "muted" {
  if (role === AdminRole.OWNER) return "warning";
  if (role === AdminRole.ADMIN) return "info";
  if (role === AdminRole.SUPPORT) return "muted";
  return "success";
}

function assignableRoles(actorRole: AdminRole | undefined): AdminRole[] {
  const roles = [AdminRole.OWNER, AdminRole.ADMIN, AdminRole.CATALOG_MANAGER, AdminRole.FINANCE, AdminRole.SUPPORT];
  return actorRole === AdminRole.OWNER ? roles : roles.filter((role) => role !== AdminRole.OWNER);
}

function roleOptions(actorRole: AdminRole | undefined) {
  return assignableRoles(actorRole).map((role) => ({ value: role, label: ROLE_LABELS[role] }));
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [active, setActive] = useState<ActiveFilter>("active");
  const [inviteDraft, setInviteDraft] = useState<InviteDraft | null>(null);
  const [roleDraft, setRoleDraft] = useState<RoleDraft | null>(null);
  const [deactivateDraft, setDeactivateDraft] = useState<DeactivateDraft | null>(null);

  const me = useQuery({ queryKey: ["identity", "me"], queryFn: () => trpc.identity.me.query(), retry: false });
  const actorRole = me.data?.profile.role;
  const assignable = useMemo(() => roleOptions(actorRole), [actorRole]);

  const users = useQuery({
    queryKey: ["settings", "admin-users", search, role, active],
    queryFn: () =>
      trpc.settings.listAdminUsers.query({
        limit: 50,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(role !== "all" ? { role } : {}),
        ...(active !== "all" ? { isActive: active === "active" } : {}),
      }),
  });

  const invite = useMutation({
    mutationFn: (input: InviteDraft) =>
      trpc.settings.inviteAdminUser.mutate({
        email: input.email.trim(),
        fullName: input.fullName.trim(),
        role: input.role,
        ...(input.reason.trim() ? { reason: input.reason.trim() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "admin-users"] });
      toast({ tone: "success", title: "Invitacion enviada" });
      setInviteDraft(null);
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo invitar", message: err instanceof Error ? err.message : "Revisa los datos." }),
  });

  const setUserRole = useMutation({
    mutationFn: (input: RoleDraft) =>
      trpc.settings.setUserRole.mutate({
        userId: input.user.id,
        role: input.role,
        ...(input.reason.trim() ? { reason: input.reason.trim() } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "admin-users"] });
      toast({ tone: "success", title: "Rol actualizado" });
      setRoleDraft(null);
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo cambiar el rol", message: err instanceof Error ? err.message : "Intentelo de nuevo." }),
  });

  const deactivate = useMutation({
    mutationFn: (input: DeactivateDraft) => trpc.settings.deactivateUser.mutate({ userId: input.user.id, reason: input.reason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "admin-users"] });
      toast({ tone: "success", title: "Usuario desactivado" });
      setDeactivateDraft(null);
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo desactivar", message: err instanceof Error ? err.message : "Intentelo de nuevo." }),
  });

  const openInvite = () =>
    setInviteDraft({
      email: "",
      fullName: "",
      role: assignable[0]?.value as AdminRole,
      reason: "",
    });

  const columns = useMemo<ColumnDef<AdminUserSummary, unknown>[]>(
    () => [
      {
        id: "user",
        header: "Usuario",
        cell: ({ row }) => (
          <div className="admin-mini-prod">
            <span className="admin-mini-prod__mp">
              <Users size={16} />
            </span>
            <span>
              <span className="admin-cell-str">{row.original.fullName}</span>
              <span className="admin-cell-sub">{row.original.email}</span>
            </span>
          </div>
        ),
      },
      {
        id: "role",
        header: "Rol",
        cell: ({ row }) => <Badge tone={roleTone(row.original.role)}>{ROLE_LABELS[row.original.role]}</Badge>,
      },
      {
        id: "active",
        header: "Estado",
        cell: ({ row }) => <Badge tone={row.original.isActive ? "success" : "muted"}>{row.original.isActive ? "Activo" : "Inactivo"}</Badge>,
      },
      {
        id: "mfa",
        header: "MFA",
        cell: ({ row }) => <Badge tone={row.original.mfaEnabled ? "success" : "warning"}>{row.original.mfaEnabled ? "Habilitado" : "Pendiente"}</Badge>,
      },
      {
        id: "lastLogin",
        header: "Ultimo login",
        cell: ({ row }) => (
          <span className="admin-mono" style={{ color: "var(--admin-text-secondary)" }}>
            {row.original.lastLoginAt ? formatDate(row.original.lastLoginAt) : "Sin login"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button
              size="sm"
              variant="outline"
              disabled={!row.original.isActive}
              onClick={(event) => {
                event.stopPropagation();
                const roleAllowed = assignableRoles(actorRole).includes(row.original.role);
                setRoleDraft({ user: row.original, role: roleAllowed ? row.original.role : (assignable[0]?.value as AdminRole), reason: "" });
              }}
            >
              Cambiar rol
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={!row.original.isActive}
              onClick={(event) => {
                event.stopPropagation();
                setDeactivateDraft({ user: row.original, reason: "" });
              }}
            >
              Desactivar
            </Button>
          </div>
        ),
      },
    ],
    [actorRole, assignable],
  );

  const items = users.data?.items ?? [];
  const inviteCanSubmit =
    inviteDraft !== null &&
    inviteDraft.email.trim().length > 0 &&
    inviteDraft.fullName.trim().length > 0 &&
    assignableRoles(actorRole).includes(inviteDraft.role);
  const roleCanSubmit = roleDraft !== null && assignableRoles(actorRole).includes(roleDraft.role);
  const deactivateCanSubmit = deactivateDraft !== null && deactivateDraft.reason.trim().length > 0;

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Usuarios admin</h1>
          <div className="admin-ph__sub">Invitaciones, roles y desactivacion con trazabilidad.</div>
        </div>
        <div className="admin-ph__actions">
          <Button variant="primary" onClick={openInvite}>
            <UserPlus size={16} /> Invitar usuario
          </Button>
        </div>
      </div>

      <div className="admin-tbl-card">
        <div className="admin-toolbar">
          <div className="admin-field" style={{ minWidth: 260 }}>
            <Shield size={15} />
            <input placeholder="Buscar por nombre o email" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {ROLE_FILTERS.map((item) => (
            <span key={item.value} className="admin-chip" data-on={role === item.value || undefined} onClick={() => setRole(item.value)}>
              {item.label}
            </span>
          ))}
          {ACTIVE_FILTERS.map((item) => (
            <span key={item.value} className="admin-chip" data-on={active === item.value || undefined} onClick={() => setActive(item.value)}>
              {item.label}
            </span>
          ))}
        </div>
        <DataTable
          columns={columns}
          data={items}
          loading={users.isLoading}
          emptyState={
            <div>
              <Users size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
              <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin usuarios</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>Proba limpiar los filtros o invitar un usuario.</div>
            </div>
          }
        />
      </div>

      <Dialog open={inviteDraft !== null} onOpenChange={(open) => !open && setInviteDraft(null)}>
        <DialogContent
          title="Invitar usuario"
          description="El rol disponible se filtra segun tu permiso actual."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="primary" loading={invite.isPending} disabled={!inviteCanSubmit} onClick={() => inviteDraft && invite.mutate(inviteDraft)}>
                Enviar invitacion
              </Button>
            </>
          }
        >
          {inviteDraft && (
            <div style={{ display: "grid", gap: 14 }}>
              <label className="admin-form-g">
                <span>Email</span>
                <input className="ui-input" type="email" value={inviteDraft.email} onChange={(e) => setInviteDraft({ ...inviteDraft, email: e.target.value })} />
              </label>
              <label className="admin-form-g">
                <span>Nombre completo</span>
                <input className="ui-input" value={inviteDraft.fullName} onChange={(e) => setInviteDraft({ ...inviteDraft, fullName: e.target.value })} />
              </label>
              <label className="admin-form-g">
                <span>Rol</span>
                <Select options={assignable} value={inviteDraft.role} onChange={(e) => setInviteDraft({ ...inviteDraft, role: e.target.value as AdminRole })} />
              </label>
              <label className="admin-form-g">
                <span>Motivo (opcional)</span>
                <textarea className="ui-input" rows={3} value={inviteDraft.reason} onChange={(e) => setInviteDraft({ ...inviteDraft, reason: e.target.value })} />
              </label>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={roleDraft !== null} onOpenChange={(open) => !open && setRoleDraft(null)}>
        <DialogContent
          title="Cambiar rol"
          description={roleDraft ? `${roleDraft.user.fullName} - ${roleDraft.user.email}` : undefined}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="primary" loading={setUserRole.isPending} disabled={!roleCanSubmit} onClick={() => roleDraft && setUserRole.mutate(roleDraft)}>
                Guardar rol
              </Button>
            </>
          }
        >
          {roleDraft && (
            <div style={{ display: "grid", gap: 14 }}>
              <label className="admin-form-g">
                <span>Nuevo rol</span>
                <Select options={assignable} value={roleDraft.role} onChange={(e) => setRoleDraft({ ...roleDraft, role: e.target.value as AdminRole })} />
              </label>
              <label className="admin-form-g">
                <span>Motivo (opcional)</span>
                <textarea className="ui-input" rows={3} value={roleDraft.reason} onChange={(e) => setRoleDraft({ ...roleDraft, reason: e.target.value })} />
              </label>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deactivateDraft !== null} onOpenChange={(open) => !open && setDeactivateDraft(null)}>
        <DialogContent
          tone="danger"
          title="Desactivar usuario"
          description="La cuenta pierde acceso al admin. El motivo es obligatorio para auditoria."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="danger" loading={deactivate.isPending} disabled={!deactivateCanSubmit} onClick={() => deactivateDraft && deactivate.mutate(deactivateDraft)}>
                Desactivar
              </Button>
            </>
          }
        >
          {deactivateDraft && (
            <div style={{ display: "grid", gap: 14 }}>
              <div className="admin-info-strip" style={{ marginBottom: 0 }}>
                <Shield size={16} />
                <span>{deactivateDraft.user.fullName} - {deactivateDraft.user.email}</span>
              </div>
              <label className="admin-form-g">
                <span>Motivo requerido</span>
                <textarea className="ui-input" rows={4} value={deactivateDraft.reason} onChange={(e) => setDeactivateDraft({ ...deactivateDraft, reason: e.target.value })} />
              </label>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
