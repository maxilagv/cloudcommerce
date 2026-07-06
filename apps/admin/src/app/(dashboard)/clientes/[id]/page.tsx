"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, MapPin, MessageSquare, Plus, ReceiptText, Trash2, UserRound, WalletCards } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogClose,
  DialogContent,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
  type BadgeTone,
  type ColumnDef,
} from "@cloudcommerce/ui";
import {
  CustomerContactChannel,
  CustomerContactDirection,
  CustomerTier,
  type CategorySlice,
  type CustomerAddressResponse,
  type CustomerAnalyticsBreakdown,
  type CustomerAnalyticsRange,
  type CustomerContactLogResponse,
  type CustomerDetail,
  type CustomerPurchaseHistoryItem,
  type OrderSummary,
  type TimeSeriesPoint,
} from "@cloudcommerce/types";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingList } from "@/components/dashboard/ranking-list";
import { trpc } from "@/lib/trpc";
import { formatDate, formatMinor } from "@/lib/format";

function tierTone(tier: CustomerTier): BadgeTone {
  if (tier === CustomerTier.CloudPrime) return "success";
  if (tier === CustomerTier.CloudPlus) return "info";
  return "muted";
}

function isReasonRequired(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("reason") || message.includes("motivo");
}

function contactChannelLabel(channel: CustomerContactChannel): string {
  if (channel === CustomerContactChannel.CALL) return "Llamada";
  if (channel === CustomerContactChannel.WHATSAPP) return "WhatsApp";
  if (channel === CustomerContactChannel.EMAIL) return "Email";
  return "Otro";
}

function contactDirectionLabel(direction: CustomerContactDirection): string {
  return direction === CustomerContactDirection.IN ? "Entrante" : "Saliente";
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [reasonDraft, setReasonDraft] = useState("");
  const [reasonDialog, setReasonDialog] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [loggingContact, setLoggingContact] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [range, setRange] = useState<CustomerAnalyticsRange>("6M");
  const [breakdown, setBreakdown] = useState<CustomerAnalyticsBreakdown>("category");

  const detail = useQuery({
    queryKey: ["customers", "detail", customerId, reason],
    queryFn: () => trpc.customers.getDetail.query({ customerId, ...(reason ? { reason } : {}) }),
    retry: false,
  });

  const analytics = useQuery({
    queryKey: ["customers", "analytics", customerId, range, breakdown],
    queryFn: () => trpc.customers.getAnalytics.query({ customerId, range, breakdown }),
    retry: false,
  });

  const addresses = useQuery({
    queryKey: ["customers", "addresses", customerId, reason],
    queryFn: () => trpc.customers.listAddresses.query({ customerId, ...(reason ? { reason } : {}) }),
    retry: false,
  });

  const contacts = useQuery({
    queryKey: ["customers", "contacts", customerId, reason],
    queryFn: () => trpc.customers.listContacts.query({ customerId, limit: 20, ...(reason ? { reason } : {}) }),
    retry: false,
  });

  const orders = useQuery({
    queryKey: ["orders", "customer", customerId],
    queryFn: () => trpc.orders.list.query({ customerId, limit: 20, sort: "newest" }),
    retry: false,
  });

  useEffect(() => {
    if (!reason && (isReasonRequired(detail.error) || isReasonRequired(addresses.error) || isReasonRequired(contacts.error))) {
      setReasonDialog(true);
    }
  }, [detail.error, addresses.error, contacts.error, reason]);

  const softDelete = useMutation({
    mutationFn: () => trpc.customers.softDelete.mutate({ customerId, reason: deleteReason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", "search"] });
      toast({ tone: "success", title: "Cliente eliminado" });
      router.push("/clientes");
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo eliminar", message: err instanceof Error ? err.message : undefined }),
  });

  if (detail.isLoading) {
    return (
      <div className="admin-view">
        <Skeleton height={30} width={230} />
        <div style={{ marginTop: 20 }}>
          <Skeleton height={320} radius={14} />
        </div>
      </div>
    );
  }

  if ((detail.isError && !isReasonRequired(detail.error)) || !detail.data) {
    return (
      <div className="admin-view">
        <div className="admin-panel admin-empty">
          <UserRound size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
          <h4>Cliente no encontrado</h4>
          <Button variant="secondary" onClick={() => router.push("/clientes")} style={{ marginTop: 12 }}>
            Volver a clientes
          </Button>
        </div>
        <AccessReasonDialog
          open={reasonDialog}
          value={reasonDraft}
          onChange={setReasonDraft}
          onClose={() => setReasonDialog(false)}
          onConfirm={() => {
            setReason(reasonDraft.trim());
            setReasonDialog(false);
          }}
        />
      </div>
    );
  }

  const customer = detail.data;

  return (
    <div className="admin-view">
      <button className="admin-back" onClick={() => router.push("/clientes")}>
        <ArrowLeft size={16} /> Volver a clientes
      </button>

      <div className="admin-ph">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <h1>{customer.displayName}</h1>
          <Badge tone={tierTone(customer.tier)}>{customer.tier}</Badge>
        </div>
        <div className="admin-ph__actions">
          <Button variant="secondary" onClick={() => setLoggingContact(true)}>
            <MessageSquare size={16} /> Registrar contacto
          </Button>
          <Button variant="secondary" onClick={() => setEditing(true)}>
            Editar
          </Button>
          <Button variant="danger" onClick={() => setDeleting(true)}>
            <Trash2 size={16} /> Eliminar
          </Button>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <AnalyticsPanel range={range} setRange={setRange} breakdown={breakdown} setBreakdown={setBreakdown} query={analytics} />
          <OrdersPanel query={orders} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <ProfilePanel customer={customer} />
          <AddressesPanel customerId={customerId} reason={reason} query={addresses} onAdd={() => setAddingAddress(true)} />
          <ContactsPanel query={contacts} onAdd={() => setLoggingContact(true)} />
        </div>
      </div>

      <EditCustomerDialog open={editing} onClose={() => setEditing(false)} customer={customer} reason={reason} />
      <AddressDialog open={addingAddress} onClose={() => setAddingAddress(false)} customerId={customerId} reason={reason} />
      <ContactDialog open={loggingContact} onClose={() => setLoggingContact(false)} customerId={customerId} />

      <Dialog open={deleting} onOpenChange={(open) => !open && setDeleting(false)}>
        <DialogContent
          tone="danger"
          title="Eliminar cliente"
          description="Esta accion es irreversible y requiere motivo."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="danger" loading={softDelete.isPending} disabled={deleteReason.trim().length === 0} onClick={() => softDelete.mutate()}>
                Eliminar cliente
              </Button>
            </>
          }
        >
          <label className="admin-form-g">
            <span>Motivo</span>
            <textarea className="ui-input" rows={3} value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} />
          </label>
        </DialogContent>
      </Dialog>

      <AccessReasonDialog
        open={reasonDialog}
        value={reasonDraft}
        onChange={setReasonDraft}
        onClose={() => setReasonDialog(false)}
        onConfirm={() => {
          setReason(reasonDraft.trim());
          setReasonDialog(false);
        }}
      />
    </div>
  );
}

function AnalyticsPanel({
  range,
  setRange,
  breakdown,
  setBreakdown,
  query,
}: {
  range: CustomerAnalyticsRange;
  setRange: (range: CustomerAnalyticsRange) => void;
  breakdown: CustomerAnalyticsBreakdown;
  setBreakdown: (breakdown: CustomerAnalyticsBreakdown) => void;
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof trpc.customers.getAnalytics.query>>>>;
}) {
  const data = query.data;
  const points: TimeSeriesPoint[] = data?.spendingSeries.map((point) => ({ bucket: point.month, label: point.month, value: point.amount })) ?? [];
  const categorySlices: CategorySlice[] =
    data?.purchaseBreakdown.map((slice) => ({
      categoryId: slice.key,
      name: slice.label,
      value: slice.amountMinor ?? slice.value,
      share: slice.pct ?? 0,
    })) ?? [];
  const rankingItems =
    data?.purchaseBreakdown.map((slice) => ({
      id: slice.key,
      label: slice.label,
      value: slice.value,
      valueLabel: slice.amountMinor ? formatMinor(slice.amountMinor) : String(slice.value),
    })) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="admin-grid admin-grid--kpi">
        {query.isLoading || !data ? (
          [0, 1, 2, 3].map((item) => (
            <div className="admin-kpi" key={item}>
              <Skeleton height={12} width="50%" />
              <div style={{ marginTop: 14 }}><Skeleton height={24} width="70%" /></div>
            </div>
          ))
        ) : (
          <>
            <KpiCard label="Pedidos" value={data.ordersCount} format={(value) => Math.round(value).toLocaleString("es-AR")} icon={ReceiptText} index={0} />
            <KpiCard label="Gasto total" value={data.totalSpent.amountMinor} format={(value) => formatMinor(Math.round(value))} icon={WalletCards} index={1} />
            <KpiCard label="Ticket promedio" value={data.aov.amountMinor} format={(value) => formatMinor(Math.round(value))} icon={BarChart3} index={2} />
            {data.investedAvailable && data.margin ? (
              <KpiCard label="Margen" value={data.margin.amount.amountMinor} format={(value) => formatMinor(Math.round(value))} icon={BarChart3} index={3} />
            ) : (
              <div className="admin-kpi">
                <div className="admin-kpi__h"><span className="admin-kpi__lbl">Margen</span><span className="admin-kpi__ic"><BarChart3 size={17} /></span></div>
                <div className="admin-cell-sub" style={{ marginTop: 14 }}>No disponible para tu rol</div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel__h">
          <h3>Gasto en el tiempo</h3>
          <div className="admin-segs">
            {(["3M", "6M", "12M"] as CustomerAnalyticsRange[]).map((item) => (
              <button key={item} data-on={range === item || undefined} onClick={() => setRange(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
        {query.isLoading ? <Skeleton height={210} radius={12} /> : <RevenueAreaChart points={points} format={formatMinor} height={210} />}
      </div>

      <div className="admin-panel">
        <div className="admin-panel__h">
          <h3>Breakdown de compras</h3>
          <div className="admin-segs">
            <button data-on={breakdown === "category" || undefined} onClick={() => setBreakdown("category")}>Categoria</button>
            <button data-on={breakdown === "spend" || undefined} onClick={() => setBreakdown("spend")}>Gasto</button>
          </div>
        </div>
        {query.isLoading ? (
          <Skeleton height={170} radius={12} />
        ) : breakdown === "category" ? (
          <CategoryBarChart slices={categorySlices} format={formatMinor} />
        ) : (
          <RankingList items={rankingItems} />
        )}
      </div>
    </div>
  );
}

function OrdersPanel({ query }: { query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof trpc.orders.list.query>>>> }) {
  const columns = useMemo<ColumnDef<OrderSummary, unknown>[]>(
    () => [
      {
        id: "order",
        header: "Pedido",
        cell: ({ row }) => (
          <Link href={`/pedidos/${row.original.id}`} style={{ color: "var(--admin-accent)", fontWeight: 650 }}>
            {row.original.orderNumber}
          </Link>
        ),
      },
      { id: "status", header: "Estado", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: "total", header: "Total", cell: ({ row }) => <span className="admin-mono">{formatMinor(row.original.total.amountMinor)}</span> },
      { id: "date", header: "Fecha", cell: ({ row }) => <span className="admin-cell-sub">{formatDate(row.original.createdAt)}</span> },
    ],
    [],
  );

  return (
    <div className="admin-tbl-card">
      <div className="admin-toolbar">
        <span className="admin-chip" data-on>Historial de pedidos</span>
      </div>
      {query.isError ? (
        <div className="admin-empty">No se pudieron cargar los pedidos del cliente</div>
      ) : (
        <DataTable
          columns={columns}
          data={query.data?.items ?? []}
          loading={query.isLoading}
          emptyState={<div className="admin-empty">Sin pedidos para este cliente.</div>}
        />
      )}
    </div>
  );
}

function ProfilePanel({ customer }: { customer: CustomerDetail }) {
  return (
    <div className="admin-panel">
      <div className="sc-lbl">Perfil</div>
      <div className="admin-detail-kv"><span>Email</span><b>{customer.email ?? "-"}</b></div>
      <div className="admin-detail-kv"><span>WhatsApp</span><b>{customer.whatsapp ?? "-"}</b></div>
      <div className="admin-detail-kv"><span>Contactos</span><b className="admin-mono">{customer.contactsCount}</b></div>
      <div className="admin-detail-kv"><span>Ultimo contacto</span><b>{customer.lastContactAt ? formatDate(customer.lastContactAt) : "-"}</b></div>
      <div className="admin-detail-kv"><span>Creado</span><b>{formatDate(customer.createdAt)}</b></div>
      {customer.notes && <div className="admin-cell-sub" style={{ marginTop: 12 }}>{customer.notes}</div>}
    </div>
  );
}

function AddressesPanel({
  customerId,
  reason,
  query,
  onAdd,
}: {
  customerId: string;
  reason: string;
  query: ReturnType<typeof useQuery<CustomerAddressResponse[]>>;
  onAdd: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const setPrimary = useMutation({
    mutationFn: (addressId: string) => trpc.customers.setPrimaryAddress.mutate({ customerId, addressId, ...(reason ? { reason } : {}) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", "addresses", customerId] });
      qc.invalidateQueries({ queryKey: ["customers", "detail", customerId] });
      toast({ tone: "success", title: "Domicilio principal actualizado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo actualizar", message: err instanceof Error ? err.message : undefined }),
  });

  return (
    <div className="admin-panel">
      <div className="admin-panel__h">
        <h3>Domicilios</h3>
        <Button variant="secondary" size="sm" onClick={onAdd}><Plus size={15} /> Agregar</Button>
      </div>
      {query.isLoading ? (
        <Skeleton height={90} radius={12} />
      ) : query.isError ? (
        <div className="admin-cell-sub">No disponible sin motivo de acceso.</div>
      ) : (query.data ?? []).length === 0 ? (
        <div className="admin-cell-sub">Sin domicilios cargados.</div>
      ) : (
        (query.data ?? []).map((address) => (
          <div className="admin-session" key={address.id} style={{ marginBottom: 8 }}>
            <span className="admin-session__ic"><MapPin size={18} /></span>
            <div className="admin-session__info">
              <div className="admin-session__t">{address.label ?? "Domicilio"} {address.isPrimary && <Badge tone="success">Principal</Badge>}</div>
              <div className="admin-session__m">{address.street} {address.streetNumber ?? ""}, {address.city}, {address.province}</div>
            </div>
            {!address.isPrimary && (
              <Button variant="ghost" size="sm" loading={setPrimary.isPending} onClick={() => setPrimary.mutate(address.id)}>
                Principal
              </Button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function ContactsPanel({ query, onAdd }: { query: ReturnType<typeof useQuery<{ items: CustomerContactLogResponse[]; nextCursor: string | null }>>; onAdd: () => void }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel__h">
        <h3>Contactos</h3>
        <Button variant="secondary" size="sm" onClick={onAdd}><Plus size={15} /> Registrar</Button>
      </div>
      {query.isLoading ? (
        <Skeleton height={90} radius={12} />
      ) : query.isError ? (
        <div className="admin-cell-sub">No disponible sin motivo de acceso.</div>
      ) : (query.data?.items ?? []).length === 0 ? (
        <div className="admin-cell-sub">Sin contactos registrados.</div>
      ) : (
        (query.data?.items ?? []).map((contact) => (
          <div className="admin-activity__row" key={contact.id}>
            <Badge tone="info">{contactChannelLabel(contact.channel)}</Badge>
            <div>
              <div className="admin-cell-str">{contactDirectionLabel(contact.direction)} - {formatDate(contact.occurredAt)}</div>
              <div className="admin-cell-sub">{contact.note ?? "Sin nota"}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function EditCustomerDialog({ open, onClose, customer, reason }: { open: boolean; onClose: () => void; customer: CustomerDetail; reason: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState(customer.firstName);
  const [lastName, setLastName] = useState(customer.lastName);
  const [whatsapp, setWhatsapp] = useState(customer.whatsapp ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");

  useEffect(() => {
    if (!open) return;
    setFirstName(customer.firstName);
    setLastName(customer.lastName);
    setWhatsapp(customer.whatsapp ?? "");
    setEmail(customer.email ?? "");
    setNotes(customer.notes ?? "");
  }, [open, customer]);

  const update = useMutation({
    mutationFn: () =>
      trpc.customers.update.mutate({
        customerId: customer.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(reason ? { reason } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", "detail", customer.id] });
      qc.invalidateQueries({ queryKey: ["customers", "search"] });
      toast({ tone: "success", title: "Cliente guardado" });
      onClose();
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo guardar", message: err instanceof Error ? err.message : undefined }),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Editar cliente"
        footer={
          <>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button variant="primary" loading={update.isPending} disabled={!firstName.trim() || !lastName.trim()} onClick={() => update.mutate()}>
              Guardar
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input className="ui-input" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            <input className="ui-input" value={lastName} onChange={(event) => setLastName(event.target.value)} />
          </div>
          <input className="ui-input" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="WhatsApp" />
          <input className="ui-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <textarea className="ui-input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notas" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddressDialog({ open, onClose, customerId, reason }: { open: boolean; onClose: () => void; customerId: string; reason: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [label, setLabel] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const add = useMutation({
    mutationFn: () =>
      trpc.customers.addAddress.mutate({
        customerId,
        province: province.trim(),
        city: city.trim(),
        street: street.trim(),
        ...(streetNumber.trim() ? { streetNumber: streetNumber.trim() } : {}),
        ...(postalCode.trim() ? { postalCode: postalCode.trim() } : {}),
        ...(label.trim() ? { label: label.trim() } : {}),
        ...(recipientName.trim() ? { recipientName: recipientName.trim() } : {}),
        isPrimary: false,
        ...(reason ? { reason } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", "addresses", customerId] });
      toast({ tone: "success", title: "Domicilio agregado" });
      onClose();
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo agregar", message: err instanceof Error ? err.message : undefined }),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Agregar domicilio"
        footer={
          <>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button variant="primary" loading={add.isPending} disabled={!province.trim() || !city.trim() || !street.trim()} onClick={() => add.mutate()}>
              Agregar
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input className="ui-input" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Etiqueta" />
            <input className="ui-input" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Receptor" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input className="ui-input" value={province} onChange={(event) => setProvince(event.target.value)} placeholder="Provincia" />
            <input className="ui-input" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ciudad" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
            <input className="ui-input" value={street} onChange={(event) => setStreet(event.target.value)} placeholder="Calle" />
            <input className="ui-input" value={streetNumber} onChange={(event) => setStreetNumber(event.target.value)} placeholder="Numero" />
          </div>
          <input className="ui-input" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="Codigo postal" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContactDialog({ open, onClose, customerId }: { open: boolean; onClose: () => void; customerId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [channel, setChannel] = useState<CustomerContactChannel>(CustomerContactChannel.WHATSAPP);
  const [direction, setDirection] = useState<CustomerContactDirection>(CustomerContactDirection.OUT);
  const [note, setNote] = useState("");

  const log = useMutation({
    mutationFn: () =>
      trpc.customers.logContact.mutate({
        customerId,
        channel,
        direction,
        ...(note.trim() ? { note: note.trim() } : {}),
        occurredAt: new Date(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers", "contacts", customerId] });
      qc.invalidateQueries({ queryKey: ["customers", "detail", customerId] });
      toast({ tone: "success", title: "Contacto registrado" });
      setNote("");
      onClose();
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo registrar", message: err instanceof Error ? err.message : undefined }),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Registrar contacto"
        footer={
          <>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button variant="primary" loading={log.isPending} onClick={() => log.mutate()}>
              Registrar
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <Select
            value={channel}
            onChange={(event) => setChannel(event.target.value as CustomerContactChannel)}
            options={[
              { value: CustomerContactChannel.CALL, label: "Llamada" },
              { value: CustomerContactChannel.WHATSAPP, label: "WhatsApp" },
              { value: CustomerContactChannel.EMAIL, label: "Email" },
              { value: CustomerContactChannel.OTHER, label: "Otro" },
            ]}
          />
          <Select
            value={direction}
            onChange={(event) => setDirection(event.target.value as CustomerContactDirection)}
            options={[
              { value: CustomerContactDirection.IN, label: "Entrante" },
              { value: CustomerContactDirection.OUT, label: "Saliente" },
            ]}
          />
          <textarea className="ui-input" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Nota opcional" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AccessReasonDialog({
  open,
  value,
  onChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Motivo de acceso"
        description="Tu rol requiere justificar el acceso a datos sensibles."
        footer={
          <>
            <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
            <Button variant="primary" disabled={value.trim().length < 3} onClick={onConfirm}>
              Reintentar
            </Button>
          </>
        }
      >
        <label className="admin-form-g">
          <span>Motivo</span>
          <textarea className="ui-input" rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
        </label>
      </DialogContent>
    </Dialog>
  );
}
