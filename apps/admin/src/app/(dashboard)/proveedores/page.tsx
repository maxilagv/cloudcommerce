"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus, Search, Truck } from "lucide-react";
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
import type { SupplierContact, SupplierSummary } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/format";
import { slugify } from "@/lib/slug";

type ActiveFilter = "all" | "active" | "inactive";

const ACTIVE_FILTERS: { label: string; value: ActiveFilter }[] = [
  { label: "Todos", value: "all" },
  { label: "Activos", value: "active" },
  { label: "Inactivos", value: "inactive" },
];

function connectionState(supplier: SupplierSummary): { tone: BadgeTone; label: string } {
  if (!supplier.isActive) return { tone: "muted", label: "Inactivo" };
  if (!supplier.hasApiConfig) return { tone: "warning", label: "Sin configurar" };
  return { tone: "success", label: "Conectado" };
}

function buildContact(person: string, email: string, phone: string): SupplierContact | undefined {
  const contact = {
    ...(person.trim() ? { person: person.trim() } : {}),
    ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
    ...(phone.trim() ? { phone: phone.trim() } : {}),
  };
  return Object.keys(contact).length > 0 ? contact : undefined;
}

export default function SuppliersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<ActiveFilter>("all");
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["suppliers", "list", active],
    queryFn: () =>
      trpc.suppliers.list.query({
        limit: 50,
        ...(active === "active" ? { isActive: true } : {}),
        ...(active === "inactive" ? { isActive: false } : {}),
      }),
    retry: false,
  });

  const columns = useMemo<ColumnDef<SupplierSummary, unknown>[]>(
    () => [
      {
        id: "supplier",
        header: "Proveedor",
        cell: ({ row }) => (
          <div className="admin-mini-prod">
            <span className="admin-mini-prod__mp">
              <Truck size={16} />
            </span>
            <span>
              <span className="admin-cell-str">{row.original.name}</span>
              <span className="admin-cell-sub admin-mono">{row.original.slug}</span>
            </span>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Contacto",
        cell: ({ row }) => (
          <span>
            <span className="admin-cell-str">{row.original.contact?.person ?? "Sin contacto"}</span>
            <span className="admin-cell-sub">{row.original.contact?.email ?? row.original.contact?.phone ?? "-"}</span>
          </span>
        ),
      },
      {
        id: "connection",
        header: "Conexion",
        cell: ({ row }) => {
          const state = connectionState(row.original);
          return <Badge tone={state.tone}>{state.label}</Badge>;
        },
      },
      {
        id: "updated",
        header: "Actualizado",
        cell: ({ row }) => <span className="admin-cell-sub">{formatDate(row.original.updatedAt)}</span>,
      },
    ],
    [],
  );

  const suppliers = query.data?.items ?? [];
  const filtered = suppliers.filter((supplier) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [supplier.name, supplier.slug, supplier.contact?.email, supplier.contact?.person, supplier.contact?.phone]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(term));
  });

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Proveedores</h1>
          <div className="admin-ph__sub">
            {filtered.length} proveedor(es){query.data?.nextCursor ? "+" : ""} en el motor dropshipping
          </div>
        </div>
        <div className="admin-ph__actions">
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nuevo proveedor
          </Button>
        </div>
      </div>

      {query.isError ? (
        <div className="admin-panel admin-empty">
          <Truck size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
          <h4>No se pudieron cargar los proveedores</h4>
          <Button variant="secondary" onClick={() => query.refetch()} style={{ marginTop: 12 }}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="admin-tbl-card">
          <div className="admin-toolbar">
            <div className="admin-field" style={{ minWidth: 250 }}>
              <Search size={15} />
              <input placeholder="Buscar proveedor" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            {ACTIVE_FILTERS.map((filter) => (
              <span
                key={filter.value}
                className="admin-chip"
                data-on={active === filter.value || undefined}
                onClick={() => setActive(filter.value)}
              >
                {filter.label}
              </span>
            ))}
          </div>
          <DataTable
            columns={columns}
            data={filtered}
            loading={query.isLoading}
            onRowClick={(row) => router.push(`/proveedores/${row.id}`)}
            emptyState={
              <div>
                <Truck size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
                <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin proveedores</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>
                  {search || active !== "all" ? "Proba limpiar los filtros" : "Crea tu primer proveedor"}
                </div>
              </div>
            }
          />
        </div>
      )}

      <CreateSupplierDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(supplierId) => {
          qc.invalidateQueries({ queryKey: ["suppliers", "list"] });
          router.push(`/proveedores/${supplierId}`);
        }}
      />
    </div>
  );
}

function CreateSupplierDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (supplierId: string) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [person, setPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const create = useMutation({
    mutationFn: () =>
      trpc.suppliers.create.mutate({
        name: name.trim(),
        slug: slugify(name),
        contact: buildContact(person, email, phone),
      }),
    onSuccess: (supplier) => {
      toast({ tone: "success", title: "Proveedor creado" });
      setName("");
      setPerson("");
      setEmail("");
      setPhone("");
      onClose();
      onSaved(supplier.id);
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo crear", message: err instanceof Error ? err.message : undefined }),
  });

  const canSubmit = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Nuevo proveedor"
        description="La configuracion de API y feed se completa desde el detalle."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button variant="primary" loading={create.isPending} disabled={!canSubmit} onClick={() => create.mutate()}>
              Crear proveedor
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <label className="admin-form-g">
            <span>Nombre</span>
            <input className="ui-input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="admin-form-g">
            <span>Persona de contacto</span>
            <input className="ui-input" value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Opcional" />
          </label>
          <label className="admin-form-g">
            <span>Email</span>
            <input className="ui-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Opcional" />
          </label>
          <label className="admin-form-g">
            <span>Telefono</span>
            <input className="ui-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Opcional" />
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
