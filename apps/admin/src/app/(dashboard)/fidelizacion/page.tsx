"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  BadgeCheck,
  Check,
  CircleSlash,
  Cloud,
  Coins,
  Gift,
  Hourglass,
  Package,
  Plus,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Select,
  Skeleton,
  Switch,
  useToast,
} from "@cloudcommerce/ui";
import {
  CloudDigitalStatus,
  LoyaltyRedemptionStatus,
  LoyaltyRewardKind,
  type CloudDigitalBenefitView,
  type LoyaltyRewardView,
} from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";

const nf = new Intl.NumberFormat("es-AR");

const dateFmt = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** ISO ↔ input[type=datetime-local] (hora local, sin zona). */
const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (value: string): Date | null => (value ? new Date(value) : null);

type Tab = "rewards" | "redemptions" | "clouddigital" | "config";

const TABS: { id: Tab; label: string }[] = [
  { id: "rewards", label: "Recompensas" },
  { id: "redemptions", label: "Canjes" },
  { id: "clouddigital", label: "CloudDigital" },
  { id: "config", label: "Configuración" },
];

export default function LoyaltyPage() {
  const [tab, setTab] = useState<Tab>("rewards");

  const stats = useQuery({
    queryKey: ["loyalty", "stats"],
    queryFn: () => trpc.loyalty.admin.stats.query(),
  });

  const kpis = [
    { label: "Cuentas con puntos", value: stats.data?.accounts, icon: Users },
    { label: "Puntos emitidos", value: stats.data?.pointsIssued, icon: Coins },
    { label: "Puntos canjeados", value: stats.data?.pointsRedeemed, icon: Gift },
    { label: "Canjes pendientes", value: stats.data?.pendingRedemptions, icon: Ticket },
  ];

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Fidelización</h1>
          <div className="admin-ph__sub">CloudPoints y CloudDigital — regalos, canjes y beneficios</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 18 }}>
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="admin-panel" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <span className="admin-cell-sub" style={{ margin: 0 }}>{kpi.label}</span>
                <Icon size={15} style={{ color: "var(--admin-accent)", flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6, color: "var(--admin-text-primary)" }}>
                {stats.isLoading ? <Skeleton height={26} width={70} /> : nf.format(kpi.value ?? 0)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="admin-toolbar" style={{ marginBottom: 14 }}>
        {TABS.map((t) => (
          <span key={t.id} className="admin-chip" data-on={tab === t.id || undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </span>
        ))}
      </div>

      {tab === "rewards" && <RewardsTab />}
      {tab === "redemptions" && <RedemptionsTab />}
      {tab === "clouddigital" && <CloudDigitalTab />}
      {tab === "config" && <ConfigTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recompensas
// ---------------------------------------------------------------------------

function RewardsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<LoyaltyRewardView> | null>(null);

  const rewards = useQuery({
    queryKey: ["loyalty", "rewards"],
    queryFn: () => trpc.loyalty.admin.listRewards.query(),
  });

  const upsert = useMutation({
    mutationFn: (input: Parameters<typeof trpc.loyalty.admin.upsertReward.mutate>[0]) =>
      trpc.loyalty.admin.upsertReward.mutate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty"] });
      toast({ tone: "success", title: "Recompensa guardada" });
      setEditing(null);
    },
    onError: (err) =>
      toast({ tone: "error", title: "No se pudo guardar", message: err instanceof Error ? err.message : undefined }),
  });

  const now = Date.now();
  const windowState = (r: LoyaltyRewardView): { label: string; tone: "success" | "warning" | "muted" } => {
    if (!r.isActive) return { label: "Inactiva", tone: "muted" };
    if (r.availableFrom && new Date(r.availableFrom).getTime() > now) return { label: "Programada", tone: "warning" };
    if (r.availableUntil && new Date(r.availableUntil).getTime() <= now) return { label: "Rotación cerrada", tone: "muted" };
    return { label: "En rotación", tone: "success" };
  };

  return (
    <div className="admin-tbl-card">
      <div className="admin-toolbar">
        <span className="admin-cell-sub" style={{ margin: 0 }}>
          Los regalos con ventana de fechas rotan solos: fuera de la ventana dejan de canjearse.
        </span>
        <div style={{ marginLeft: "auto" }}>
          <Button variant="primary" onClick={() => setEditing({})}>
            <Plus size={15} /> Nueva recompensa
          </Button>
        </div>
      </div>

      {rewards.isLoading ? (
        <div style={{ padding: 20 }}><Skeleton height={120} radius={12} /></div>
      ) : (rewards.data ?? []).length === 0 ? (
        <div className="admin-empty" style={{ padding: "44px 0" }}>
          <Gift size={36} style={{ opacity: 0.4, marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: "var(--admin-text-secondary)" }}>Sin recompensas todavía</div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>Creá el primer regalo de la rotación semanal.</div>
        </div>
      ) : (
        <table className="ui-table">
          <thead>
            <tr>
              <th>Recompensa</th>
              <th>Tipo</th>
              <th style={{ textAlign: "right" }}>Costo</th>
              <th style={{ textAlign: "right" }}>Stock</th>
              <th>Ventana</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(rewards.data ?? []).map((r) => {
              const state = windowState(r);
              return (
                <tr key={r.id}>
                  <td>
                    <span className="admin-cell-str">{r.title}</span>
                    {r.description && <span className="admin-cell-sub">{r.description}</span>}
                  </td>
                  <td>
                    <Badge tone={r.kind === LoyaltyRewardKind.PHYSICAL ? "info" : "success"}>
                      {r.kind === LoyaltyRewardKind.PHYSICAL ? "Físico" : "Digital"}
                    </Badge>
                  </td>
                  <td className="admin-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                    {nf.format(r.pointsCost)} pts
                  </td>
                  <td className="admin-mono" style={{ textAlign: "right" }}>
                    {r.stock === null ? "∞" : nf.format(r.stock)}
                  </td>
                  <td style={{ fontSize: 12.5 }}>
                    {dateFmt(r.availableFrom)} → {dateFmt(r.availableUntil)}
                  </td>
                  <td>
                    <Badge tone={state.tone === "success" ? "success" : state.tone === "warning" ? "warning" : "muted"}>
                      {state.label}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(r)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <RewardDialog
        reward={editing}
        saving={upsert.isPending}
        onClose={() => setEditing(null)}
        onSave={(input) => upsert.mutate(input)}
      />
    </div>
  );
}

function RewardDialog({
  reward,
  saving,
  onClose,
  onSave,
}: {
  reward: Partial<LoyaltyRewardView> | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    title: string;
    description: string;
    kind: LoyaltyRewardKind;
    pointsCost: number;
    stock: number | null;
    availableFrom: Date | null;
    availableUntil: Date | null;
    isActive: boolean;
    position: number;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<LoyaltyRewardKind>(LoyaltyRewardKind.PHYSICAL);
  const [pointsCost, setPointsCost] = useState("100");
  const [stock, setStock] = useState("");
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [seeded, setSeeded] = useState<string | null>(null);

  // Sembrar el formulario cuando cambia el reward en edición.
  const seedKey = reward ? (reward.id ?? "new") : null;
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    setTitle(reward?.title ?? "");
    setDescription(reward?.description ?? "");
    setKind(reward?.kind ?? LoyaltyRewardKind.PHYSICAL);
    setPointsCost(String(reward?.pointsCost ?? 100));
    setStock(reward?.stock === null || reward?.stock === undefined ? "" : String(reward.stock));
    setFrom(toLocalInput(reward?.availableFrom ?? null));
    setUntil(toLocalInput(reward?.availableUntil ?? null));
    setIsActive(reward?.isActive ?? true);
  }

  const valid = title.trim().length >= 2 && Number(pointsCost) >= 1;

  return (
    <Dialog open={reward !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={reward?.id ? "Editar recompensa" : "Nueva recompensa"}
        description="Definí el costo en CloudPoints y la ventana de rotación semanal."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button
              variant="primary"
              loading={saving}
              disabled={!valid}
              onClick={() =>
                onSave({
                  ...(reward?.id ? { id: reward.id } : {}),
                  title: title.trim(),
                  description: description.trim(),
                  kind,
                  pointsCost: Number(pointsCost),
                  stock: stock.trim() === "" ? null : Math.max(0, Number(stock)),
                  availableFrom: fromLocalInput(from),
                  availableUntil: fromLocalInput(until),
                  isActive,
                  position: 0,
                })
              }
            >
              <Check size={15} /> Guardar
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <label className="admin-form-g">
            <span>Título</span>
            <input className="ui-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Auriculares CloudSound" />
          </label>
          <label className="admin-form-g">
            <span>Descripción</span>
            <textarea className="ui-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qué recibe el cliente" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <label className="admin-form-g">
              <span>Tipo</span>
              <Select
                value={kind}
                onChange={(e) => setKind(e.target.value as LoyaltyRewardKind)}
                options={[
                  { value: LoyaltyRewardKind.PHYSICAL, label: "Regalo físico" },
                  { value: LoyaltyRewardKind.DIGITAL, label: "Beneficio digital" },
                ]}
              />
            </label>
            <label className="admin-form-g">
              <span>Costo (pts)</span>
              <input className="ui-input admin-mono" type="number" min={1} value={pointsCost} onChange={(e) => setPointsCost(e.target.value)} />
            </label>
            <label className="admin-form-g">
              <span>Stock (vacío = ∞)</span>
              <input className="ui-input admin-mono" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="admin-form-g">
              <span>Disponible desde</span>
              <input className="ui-input" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="admin-form-g">
              <span>Disponible hasta (rotación)</span>
              <input className="ui-input" type="datetime-local" value={until} onChange={(e) => setUntil(e.target.value)} />
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--admin-text-secondary)" }}>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            Activa (visible y canjeable dentro de su ventana)
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Canjes
// ---------------------------------------------------------------------------

const REDEMPTION_FILTERS: { label: string; value: LoyaltyRedemptionStatus | "all" }[] = [
  { label: "Pendientes", value: LoyaltyRedemptionStatus.PENDING },
  { label: "Entregados", value: LoyaltyRedemptionStatus.FULFILLED },
  { label: "Cancelados", value: LoyaltyRedemptionStatus.CANCELLED },
  { label: "Todos", value: "all" },
];

function RedemptionsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<LoyaltyRedemptionStatus | "all">(LoyaltyRedemptionStatus.PENDING);
  const [toCancel, setToCancel] = useState<string | null>(null);

  const redemptions = useQuery({
    queryKey: ["loyalty", "redemptions", status],
    queryFn: () =>
      trpc.loyalty.admin.listRedemptions.query({
        limit: 100,
        ...(status !== "all" ? { status } : {}),
      }),
  });

  const resolve = useMutation({
    mutationFn: (input: { redemptionId: string; action: "FULFILL" | "CANCEL" }) =>
      trpc.loyalty.admin.resolveRedemption.mutate(input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["loyalty"] });
      toast({
        tone: "success",
        title: vars.action === "FULFILL" ? "Canje marcado como entregado" : "Canje cancelado",
        message: vars.action === "CANCEL" ? "Los puntos y el stock fueron devueltos." : undefined,
      });
    },
    onError: (err) =>
      toast({ tone: "error", title: "No se pudo actualizar el canje", message: err instanceof Error ? err.message : undefined }),
  });

  return (
    <div className="admin-tbl-card">
      <div className="admin-toolbar">
        {REDEMPTION_FILTERS.map((f) => (
          <span key={f.value} className="admin-chip" data-on={status === f.value || undefined} onClick={() => setStatus(f.value)}>
            {f.label}
          </span>
        ))}
      </div>

      {redemptions.isLoading ? (
        <div style={{ padding: 20 }}><Skeleton height={120} radius={12} /></div>
      ) : (redemptions.data ?? []).length === 0 ? (
        <div className="admin-empty" style={{ padding: "44px 0" }}>
          <Ticket size={36} style={{ opacity: 0.4, marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: "var(--admin-text-secondary)" }}>Sin canjes en esta vista</div>
        </div>
      ) : (
        <table className="ui-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>Recompensa</th>
              <th style={{ textAlign: "right" }}>Puntos</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(redemptions.data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="admin-mono" style={{ fontWeight: 700 }}>{r.code}</td>
                <td>
                  <span className="admin-cell-str">{r.customerName ?? "—"}</span>
                  {r.customerEmail && <span className="admin-cell-sub">{r.customerEmail}</span>}
                </td>
                <td>{r.rewardTitle}</td>
                <td className="admin-mono" style={{ textAlign: "right" }}>{nf.format(r.pointsSpent)}</td>
                <td style={{ fontSize: 12.5 }}>{dateFmt(r.createdAt)}</td>
                <td>
                  <Badge
                    tone={
                      r.status === LoyaltyRedemptionStatus.PENDING
                        ? "warning"
                        : r.status === LoyaltyRedemptionStatus.FULFILLED
                          ? "success"
                          : "muted"
                    }
                  >
                    {r.status === LoyaltyRedemptionStatus.PENDING
                      ? "Pendiente"
                      : r.status === LoyaltyRedemptionStatus.FULFILLED
                        ? "Entregado"
                        : "Cancelado"}
                  </Badge>
                </td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {r.status === LoyaltyRedemptionStatus.PENDING && (
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={resolve.isPending}
                        onClick={() => resolve.mutate({ redemptionId: r.id, action: "FULFILL" })}
                      >
                        <BadgeCheck size={14} /> Entregado
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setToCancel(r.id)}>
                        <CircleSlash size={14} /> Cancelar
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Dialog open={toCancel !== null} onOpenChange={(open) => !open && setToCancel(null)}>
        <DialogContent
          tone="danger"
          title="Cancelar canje"
          description="Se devuelven los puntos al cliente y el stock del regalo. Esta acción no se puede deshacer."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Volver</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={resolve.isPending}
                onClick={() => {
                  if (!toCancel) return;
                  resolve.mutate({ redemptionId: toCancel, action: "CANCEL" });
                  setToCancel(null);
                }}
              >
                <CircleSlash size={15} /> Cancelar canje
              </Button>
            </>
          }
        >
          <div className="admin-cell-sub">El cliente va a ver el canje como cancelado y recupera sus CloudPoints.</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CloudDigital
// ---------------------------------------------------------------------------

function CloudDigitalTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState<Partial<CloudDigitalBenefitView> | null>(null);

  const benefits = useQuery({
    queryKey: ["loyalty", "benefits"],
    queryFn: () => trpc.loyalty.admin.listBenefits.query(),
  });
  const memberships = useQuery({
    queryKey: ["loyalty", "memberships"],
    queryFn: () => trpc.loyalty.admin.listMemberships.query({ limit: 100 }),
  });

  const upsertBenefit = useMutation({
    mutationFn: (input: Parameters<typeof trpc.loyalty.admin.upsertBenefit.mutate>[0]) =>
      trpc.loyalty.admin.upsertBenefit.mutate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty", "benefits"] });
      toast({ tone: "success", title: "Beneficio guardado" });
      setEditing(null);
    },
    onError: (err) =>
      toast({ tone: "error", title: "No se pudo guardar", message: err instanceof Error ? err.message : undefined }),
  });

  const setMembership = useMutation({
    mutationFn: (input: { customerId: string; status: CloudDigitalStatus }) =>
      trpc.loyalty.admin.setMembershipStatus.mutate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty", "memberships"] });
      toast({ tone: "success", title: "Membresía actualizada" });
    },
    onError: (err) =>
      toast({ tone: "error", title: "No se pudo actualizar", message: err instanceof Error ? err.message : undefined }),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="admin-tbl-card">
        <div className="admin-toolbar">
          <span className="admin-cell-sub" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Cloud size={14} /> Beneficios de LayerCloud — los códigos solo los ven membresías activas.
          </span>
          <div style={{ marginLeft: "auto" }}>
            <Button variant="primary" onClick={() => setEditing({})}>
              <Plus size={15} /> Nuevo beneficio
            </Button>
          </div>
        </div>
        {benefits.isLoading ? (
          <div style={{ padding: 20 }}><Skeleton height={90} radius={12} /></div>
        ) : (benefits.data ?? []).length === 0 ? (
          <div className="admin-empty" style={{ padding: "34px 0" }}>
            <Sparkles size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div style={{ fontWeight: 600, color: "var(--admin-text-secondary)" }}>Sin beneficios cargados</div>
          </div>
        ) : (
          <table className="ui-table">
            <thead>
              <tr>
                <th>Beneficio</th>
                <th>Partner</th>
                <th>Descuento</th>
                <th>Código</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(benefits.data ?? []).map((b) => (
                <tr key={b.id}>
                  <td>
                    <span className="admin-cell-str">{b.title}</span>
                    {b.description && <span className="admin-cell-sub">{b.description}</span>}
                  </td>
                  <td>{b.partner}</td>
                  <td style={{ fontWeight: 700, color: "var(--admin-success)" }}>{b.discountLabel}</td>
                  <td className="admin-mono">{b.code ?? "—"}</td>
                  <td>
                    <Badge tone={b.isActive ? "success" : "muted"}>{b.isActive ? "Activo" : "Oculto"}</Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Button variant="secondary" size="sm" onClick={() => setEditing(b)}>
                      Editar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="admin-tbl-card">
        <div className="admin-toolbar">
          <span className="admin-cell-sub" style={{ margin: 0 }}>
            Membresías — activá el acceso de los emprendedores en lista de espera.
          </span>
        </div>
        {memberships.isLoading ? (
          <div style={{ padding: 20 }}><Skeleton height={90} radius={12} /></div>
        ) : (memberships.data ?? []).length === 0 ? (
          <div className="admin-empty" style={{ padding: "34px 0" }}>
            <Users size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div style={{ fontWeight: 600, color: "var(--admin-text-secondary)" }}>Nadie se sumó todavía</div>
          </div>
        ) : (
          <table className="ui-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Se sumó</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(memberships.data ?? []).map((m) => (
                <tr key={m.customerId}>
                  <td>
                    <span className="admin-cell-str">{m.customerName ?? "—"}</span>
                    {m.customerEmail && <span className="admin-cell-sub">{m.customerEmail}</span>}
                  </td>
                  <td style={{ fontSize: 12.5 }}>{dateFmt(m.joinedAt)}</td>
                  <td>
                    <Badge
                      tone={
                        m.status === CloudDigitalStatus.ACTIVE
                          ? "success"
                          : m.status === CloudDigitalStatus.WAITLIST
                            ? "warning"
                            : "muted"
                      }
                    >
                      {m.status === CloudDigitalStatus.ACTIVE
                        ? "Activa"
                        : m.status === CloudDigitalStatus.WAITLIST
                          ? "Lista de espera"
                          : "Revocada"}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      {m.status !== CloudDigitalStatus.ACTIVE && (
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={setMembership.isPending}
                          onClick={() => setMembership.mutate({ customerId: m.customerId, status: CloudDigitalStatus.ACTIVE })}
                        >
                          <BadgeCheck size={14} /> Activar
                        </Button>
                      )}
                      {m.status === CloudDigitalStatus.ACTIVE && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={setMembership.isPending}
                          onClick={() => setMembership.mutate({ customerId: m.customerId, status: CloudDigitalStatus.REVOKED })}
                        >
                          <CircleSlash size={14} /> Revocar
                        </Button>
                      )}
                      {m.status === CloudDigitalStatus.REVOKED && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={setMembership.isPending}
                          onClick={() => setMembership.mutate({ customerId: m.customerId, status: CloudDigitalStatus.WAITLIST })}
                        >
                          <Hourglass size={14} /> A lista de espera
                        </Button>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <BenefitDialog
        benefit={editing}
        saving={upsertBenefit.isPending}
        onClose={() => setEditing(null)}
        onSave={(input) => upsertBenefit.mutate(input)}
      />
    </div>
  );
}

function BenefitDialog({
  benefit,
  saving,
  onClose,
  onSave,
}: {
  benefit: Partial<CloudDigitalBenefitView> | null;
  saving: boolean;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    title: string;
    description: string;
    partner: string;
    discountLabel: string;
    code: string | null;
    url: string | null;
    isActive: boolean;
    position: number;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [partner, setPartner] = useState("LayerCloud");
  const [discountLabel, setDiscountLabel] = useState("");
  const [code, setCode] = useState("");
  const [url, setUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [seeded, setSeeded] = useState<string | null>(null);

  const seedKey = benefit ? (benefit.id ?? "new") : null;
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    setTitle(benefit?.title ?? "");
    setDescription(benefit?.description ?? "");
    setPartner(benefit?.partner ?? "LayerCloud");
    setDiscountLabel(benefit?.discountLabel ?? "");
    setCode(benefit?.code ?? "");
    setUrl(benefit?.url ?? "");
    setIsActive(benefit?.isActive ?? true);
  }

  const valid = title.trim().length >= 2 && discountLabel.trim().length >= 1;

  return (
    <Dialog open={benefit !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        title={benefit?.id ? "Editar beneficio" : "Nuevo beneficio"}
        description="Beneficio de CloudDigital en LayerCloud."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button
              variant="primary"
              loading={saving}
              disabled={!valid}
              onClick={() =>
                onSave({
                  ...(benefit?.id ? { id: benefit.id } : {}),
                  title: title.trim(),
                  description: description.trim(),
                  partner: partner.trim() || "LayerCloud",
                  discountLabel: discountLabel.trim(),
                  code: code.trim() || null,
                  url: url.trim() || null,
                  isActive,
                  position: 0,
                })
              }
            >
              <Check size={15} /> Guardar
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <label className="admin-form-g">
            <span>Título</span>
            <input className="ui-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hosting LayerCloud Pro" />
          </label>
          <label className="admin-form-g">
            <span>Descripción</span>
            <textarea className="ui-input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="admin-form-g">
              <span>Partner</span>
              <input className="ui-input" value={partner} onChange={(e) => setPartner(e.target.value)} />
            </label>
            <label className="admin-form-g">
              <span>Descuento (etiqueta)</span>
              <input className="ui-input" value={discountLabel} onChange={(e) => setDiscountLabel(e.target.value)} placeholder="-30%" />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label className="admin-form-g">
              <span>Código (visible solo con membresía activa)</span>
              <input className="ui-input admin-mono" value={code} onChange={(e) => setCode(e.target.value)} placeholder="LAYER30" />
            </label>
            <label className="admin-form-g">
              <span>URL del beneficio</span>
              <input className="ui-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://layercloud.com/..." />
            </label>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--admin-text-secondary)" }}>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            Visible para los clientes
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

function ConfigTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [pointsPer1000, setPointsPer1000] = useState<string | null>(null);
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null);

  const config = useQuery({
    queryKey: ["loyalty", "config"],
    queryFn: () => trpc.loyalty.admin.getConfig.query(),
  });

  const save = useMutation({
    mutationFn: () =>
      trpc.loyalty.admin.updateConfig.mutate({
        pointsPer1000: Number(pointsPer1000 ?? config.data?.pointsPer1000 ?? 1),
        isEnabled: isEnabled ?? config.data?.isEnabled ?? true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["loyalty"] });
      toast({ tone: "success", title: "Configuración guardada" });
    },
    onError: (err) =>
      toast({ tone: "error", title: "No se pudo guardar", message: err instanceof Error ? err.message : undefined }),
  });

  const effectiveRate = pointsPer1000 ?? String(config.data?.pointsPer1000 ?? 1);
  const effectiveEnabled = isEnabled ?? config.data?.isEnabled ?? true;

  return (
    <div className="admin-panel" style={{ maxWidth: 560 }}>
      <div className="admin-panel__h">
        <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Coins size={16} /> Programa CloudPoints
        </h3>
      </div>
      {config.isLoading ? (
        <Skeleton height={90} radius={12} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label className="admin-form-g">
            <span>CloudPoints por cada $1.000 de compra entregada</span>
            <input
              className="ui-input admin-mono"
              type="number"
              min={0}
              max={10000}
              value={effectiveRate}
              onChange={(e) => setPointsPer1000(e.target.value)}
              style={{ maxWidth: 160 }}
            />
          </label>
          <div className="admin-cell-sub">
            Ejemplo: una compra de $55.000 otorga{" "}
            <b className="admin-mono">{nf.format(Math.floor(55 * Number(effectiveRate || 0)))}</b> puntos.
            El redondeo es siempre hacia abajo y los puntos se acreditan cuando el pedido se entrega.
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--admin-text-secondary)" }}>
            <Switch checked={effectiveEnabled} onCheckedChange={(v) => setIsEnabled(v)} />
            Programa activo (pausa la acreditación y los canjes sin perder saldos)
          </label>
          <div>
            <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
              <Package size={15} /> Guardar configuración
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
