"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Search, UserRound } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogClose,
  DialogContent,
  useToast,
  type BadgeTone,
  type ColumnDef,
} from "@cloudcommerce/ui";
import { CustomerTier, type CustomerSummary } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatDate, formatMinor } from "@/lib/format";

type TierFilter = CustomerTier | "all";

const TIER_FILTERS: { label: string; value: TierFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "CloudBase", value: CustomerTier.CloudBase },
  { label: "CloudPlus", value: CustomerTier.CloudPlus },
  { label: "CloudPrime", value: CustomerTier.CloudPrime },
];

function tierTone(tier: CustomerTier): BadgeTone {
  if (tier === CustomerTier.CloudPrime) return "success";
  if (tier === CustomerTier.CloudPlus) return "info";
  return "muted";
}

export default function CustomersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<TierFilter>("all");
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["customers", "search", search],
    queryFn: () =>
      trpc.customers.search.query({
        limit: 50,
        sort: "recent",
        ...(search.trim() ? { q: search.trim() } : {}),
      }),
    retry: false,
  });

  const columns = useMemo<ColumnDef<CustomerSummary, unknown>[]>(
    () => [
      {
        id: "customer",
        header: "Cliente",
        cell: ({ row }) => (
          <div className="admin-mini-prod">
            <span className="admin-mini-prod__mp">
              <UserRound size={16} />
            </span>
            <span>
              <span className="admin-cell-str">{row.original.displayName}</span>
              <span className="admin-cell-sub">{row.original.whatsapp ?? row.original.email ?? "sin contacto"}</span>
            </span>
          </div>
        ),
      },
      { id: "tier", header: "Tier", cell: ({ row }) => <Badge tone={tierTone(row.original.tier)}>{row.original.tier}</Badge> },
      {
        id: "spent",
        header: "Gasto total",
        cell: ({ row }) => (
          <span className="admin-mono" style={{ fontWeight: 650, color: "var(--admin-text-primary)" }}>
            {formatMinor(row.original.totalSpent.amountMinor)}
          </span>
        ),
      },
      { id: "orders", header: "Pedidos", cell: ({ row }) => <span className="admin-mono">{row.original.ordersCount}</span> },
      { id: "last", header: "Ultima compra", cell: ({ row }) => <span className="admin-cell-sub">{row.original.lastOrderAt ? formatDate(row.original.lastOrderAt) : "-"}</span> },
      { id: "city", header: "Ciudad", cell: ({ row }) => row.original.primaryCity ?? "-" },
    ],
    [],
  );

  const customers = (query.data?.items ?? []).filter((customer) => tier === "all" || customer.tier === tier);

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Clientes</h1>
          <div className="admin-ph__sub">
            {customers.length} cliente(s){query.data?.nextCursor ? "+" : ""} registrados
          </div>
        </div>
        <div className="admin-ph__actions">
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nuevo cliente
          </Button>
        </div>
      </div>

      {query.isError ? (
        <div className="admin-panel admin-empty">
          <UserRound size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
          <h4>No se pudieron cargar los clientes</h4>
          <Button variant="secondary" onClick={() => query.refetch()} style={{ marginTop: 12 }}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="admin-tbl-card">
          <div className="admin-toolbar">
            <div className="admin-field" style={{ minWidth: 260 }}>
              <Search size={15} />
              <input placeholder="Nombre, WhatsApp o email" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            {TIER_FILTERS.map((filter) => (
              <span key={filter.value} className="admin-chip" data-on={tier === filter.value || undefined} onClick={() => setTier(filter.value)}>
                {filter.label}
              </span>
            ))}
          </div>
          <DataTable
            columns={columns}
            data={customers}
            loading={query.isLoading}
            onRowClick={(row) => router.push(`/clientes/${row.id}`)}
            emptyState={
              <div>
                <UserRound size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
                <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin clientes</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>{search || tier !== "all" ? "Proba limpiar los filtros" : "Crea tu primer cliente"}</div>
              </div>
            }
          />
        </div>
      )}

      <CreateCustomerDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(customerId) => {
          qc.invalidateQueries({ queryKey: ["customers", "search"] });
          router.push(`/clientes/${customerId}`);
        }}
      />
    </div>
  );
}

function CreateCustomerDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: (customerId: string) => void }) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: () =>
      trpc.customers.create.mutate({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        reason: "Alta desde panel",
      }),
    onSuccess: (customer) => {
      toast({ tone: "success", title: "Cliente creado" });
      setFirstName("");
      setLastName("");
      setWhatsapp("");
      setEmail("");
      setNotes("");
      onClose();
      onSaved(customer.id);
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo crear", message: err instanceof Error ? err.message : undefined }),
  });

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Nuevo cliente"
        description="Datos basicos; los domicilios se agregan en el detalle."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button variant="primary" loading={create.isPending} disabled={!canSubmit} onClick={() => create.mutate()}>
              Crear cliente
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="admin-form-g">
              <span>Nombre</span>
              <input className="ui-input" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
            </label>
            <label className="admin-form-g">
              <span>Apellido</span>
              <input className="ui-input" value={lastName} onChange={(event) => setLastName(event.target.value)} />
            </label>
          </div>
          <label className="admin-form-g">
            <span>WhatsApp</span>
            <input className="ui-input" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="Opcional" />
          </label>
          <label className="admin-form-g">
            <span>Email</span>
            <input className="ui-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Opcional" />
          </label>
          <label className="admin-form-g">
            <span>Notas</span>
            <textarea className="ui-input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" />
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
