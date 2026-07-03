"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Package, Plus, Search } from "lucide-react";
import { Button, DataTable, StatusBadge, type ColumnDef } from "@cloudcommerce/ui";
import type { ProductCard, ProductStatus } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatMinor } from "@/lib/format";
import { ProductCreateDrawer } from "@/components/catalog/product-create-drawer";

const STATUS_FILTERS: { label: string; value: ProductStatus | "all" }[] = [
  { label: "Todos", value: "all" },
  { label: "Publicados", value: "PUBLISHED" as ProductStatus },
  { label: "Borrador", value: "DRAFT" as ProductStatus },
  { label: "Pausados", value: "PAUSED" as ProductStatus },
];

export default function ProductsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProductStatus | "all">("all");
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["catalog", "products", search, status],
    queryFn: () =>
      trpc.catalog.products.search.query({
        limit: 50,
        sort: "updated_desc",
        ...(search.trim().length > 0 ? { query: search.trim() } : {}),
        ...(status !== "all" ? { status } : {}),
      }),
  });

  const columns = useMemo<ColumnDef<ProductCard, unknown>[]>(
    () => [
      {
        id: "product",
        header: "Producto",
        cell: ({ row }) => (
          <div className="admin-mini-prod">
            <span className="admin-mini-prod__mp">
              <Package size={16} />
            </span>
            <span>
              <span className="admin-cell-str">{row.original.title}</span>
              <span className="admin-cell-sub admin-mono">{row.original.sku ?? "sin SKU"}</span>
            </span>
          </div>
        ),
      },
      { id: "category", header: "Categoría", cell: ({ row }) => row.original.category?.name ?? "—" },
      {
        id: "price",
        header: "Precio",
        cell: ({ row }) => (
          <span className="admin-mono" style={{ fontWeight: 600, color: "var(--admin-text-primary)" }}>
            {row.original.price ? formatMinor(row.original.price.amountMinor) : "—"}
          </span>
        ),
      },
      { id: "stock", header: "Stock", cell: ({ row }) => <StatusBadge status={row.original.stockStatus} /> },
      { id: "status", header: "Estado", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  );

  const items = query.data?.items ?? [];

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Productos</h1>
          <div className="admin-ph__sub">{items.length} productos{query.data?.nextCursor ? "+" : ""} en catálogo</div>
        </div>
        <div className="admin-ph__actions">
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nuevo producto
          </Button>
        </div>
      </div>

      <div className="admin-tbl-card">
        <div className="admin-toolbar">
          <div className="admin-field" style={{ minWidth: 240 }}>
            <Search size={15} />
            <input placeholder="Buscar por nombre…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {STATUS_FILTERS.map((f) => (
            <span
              key={f.value}
              className="admin-chip"
              data-on={status === f.value || undefined}
              onClick={() => setStatus(f.value)}
            >
              {f.label}
            </span>
          ))}
        </div>
        <DataTable
          columns={columns}
          data={items}
          loading={query.isLoading}
          onRowClick={(row) => router.push(`/productos/${row.id}`)}
          emptyState={
            <div>
              <Package size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
              <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin productos</div>
              <div style={{ fontSize: 12.5, marginTop: 4 }}>
                {search || status !== "all" ? "Probá limpiar los filtros" : "Creá tu primer producto"}
              </div>
            </div>
          }
        />
      </div>

      <ProductCreateDrawer open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
