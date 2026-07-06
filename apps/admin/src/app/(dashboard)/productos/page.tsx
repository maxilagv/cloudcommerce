"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Package, Pencil, Plus, Search } from "lucide-react";
import {
  Button,
  DataTable,
  Dialog,
  DialogClose,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  StatusBadge,
  useToast,
  type ColumnDef,
} from "@cloudcommerce/ui";
import type { ProductCard, ProductStatus } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatMinor } from "@/lib/format";
import { slugify } from "@/lib/slug";
import { ProductCreateDrawer } from "@/components/catalog/product-create-drawer";

const STATUS_FILTERS: { label: string; value: ProductStatus | "all" }[] = [
  { label: "Todos", value: "all" },
  { label: "Publicados", value: "PUBLISHED" as ProductStatus },
  { label: "Borrador", value: "DRAFT" as ProductStatus },
  { label: "Pausados", value: "PAUSED" as ProductStatus },
  { label: "Archivados", value: "ARCHIVED" as ProductStatus },
];

export default function ProductsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProductStatus | "all">("all");
  const [creating, setCreating] = useState(false);
  const [toArchive, setToArchive] = useState<ProductCard | null>(null);

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

  const invalidateList = () => qc.invalidateQueries({ queryKey: ["catalog", "products"] });

  const setProductStatus = useMutation({
    mutationFn: (input: { productId: string; status: ProductStatus }) =>
      trpc.catalog.products.setStatus.mutate(input),
  });

  /** Archive with one-click undo: the toast action restores the previous status. */
  function archiveProduct(product: ProductCard) {
    const previousStatus = product.status;
    setProductStatus.mutate(
      { productId: product.id, status: "ARCHIVED" as ProductStatus },
      {
        onSuccess: () => {
          invalidateList();
          toast({
            tone: "success",
            title: "Producto archivado",
            message: product.title,
            action: {
              label: "Deshacer",
              onClick: () =>
                setProductStatus.mutate(
                  { productId: product.id, status: previousStatus },
                  {
                    onSuccess: () => {
                      invalidateList();
                      toast({ tone: "success", title: "Archivado deshecho", message: product.title });
                    },
                    onError: (err) =>
                      toast({
                        tone: "error",
                        title: "No se pudo deshacer",
                        message: err instanceof Error ? err.message : "Restauralo desde el filtro Archivados.",
                      }),
                  },
                ),
            },
          });
        },
        onError: (err) =>
          toast({ tone: "error", title: "No se pudo archivar", message: err instanceof Error ? err.message : undefined }),
      },
    );
  }

  /** Bring an archived product back to Borrador. */
  function restoreProduct(product: ProductCard) {
    setProductStatus.mutate(
      { productId: product.id, status: "DRAFT" as ProductStatus },
      {
        onSuccess: () => {
          invalidateList();
          toast({ tone: "success", title: "Producto restaurado", message: `${product.title} volvió a Borrador.` });
        },
        onError: (err) =>
          toast({ tone: "error", title: "No se pudo restaurar", message: err instanceof Error ? err.message : undefined }),
      },
    );
  }

  const duplicate = useMutation({
    mutationFn: async (product: ProductCard) => {
      const detail = await trpc.catalog.products.byId.query({ productId: product.id });
      const suffix = Date.now().toString(36).slice(-4);
      return trpc.catalog.products.create.mutate({
        slug: `${slugify(detail.title)}-copia-${suffix}`,
        title: `${detail.title} (copia)`,
        subtitle: detail.subtitle ?? null,
        description: detail.description,
        categoryId: detail.category?.id ?? "",
        brandId: detail.brand?.id ?? null,
        mainImageId: detail.mainImage?.id ?? null,
        seoTitle: detail.seoTitle ?? undefined,
        seoDescription: detail.seoDescription ?? undefined,
      });
    },
    onSuccess: (created) => {
      invalidateList();
      toast({
        tone: "success",
        title: "Producto duplicado",
        message: "La copia queda en Borrador, sin SKU ni variantes.",
        action: { label: "Abrir copia", onClick: () => router.push(`/productos/${created.id}`) },
      });
    },
    onError: (err) =>
      toast({ tone: "error", title: "No se pudo duplicar", message: err instanceof Error ? err.message : undefined }),
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
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const p = row.original;
          const archived = p.status === ("ARCHIVED" as ProductStatus);
          return (
            // Stop propagation so the kebab never triggers the row navigation.
            <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", justifyContent: "flex-end" }}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="ui-icon-btn" aria-label={`Acciones de ${p.title}`}>
                    <MoreHorizontal size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuLabel>{p.title}</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => router.push(`/productos/${p.id}`)}>
                    <Pencil size={14} style={{ marginRight: 8 }} /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => duplicate.mutate(p)}>
                    <Copy size={14} style={{ marginRight: 8 }} /> Duplicar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {archived ? (
                    <DropdownMenuItem onSelect={() => restoreProduct(p)}>
                      <ArchiveRestore size={14} style={{ marginRight: 8 }} /> Restaurar
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem tone="danger" onSelect={() => setToArchive(p)}>
                      <Archive size={14} style={{ marginRight: 8 }} /> Archivar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router],
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

      {/* Confirmación de archivado */}
      <Dialog open={toArchive !== null} onOpenChange={(open) => !open && setToArchive(null)}>
        <DialogContent
          tone="danger"
          title="Archivar producto"
          description={
            toArchive
              ? `"${toArchive.title}" dejará de estar visible en la tienda. Podés deshacerlo al instante o restaurarlo después desde el filtro Archivados.`
              : undefined
          }
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={setProductStatus.isPending}
                onClick={() => {
                  if (!toArchive) return;
                  const product = toArchive;
                  setToArchive(null);
                  archiveProduct(product);
                }}
              >
                <Archive size={15} /> Archivar
              </Button>
            </>
          }
        >
          <div className="admin-cell-sub">
            El producto conserva su historial, precio y variantes. Ninguna venta previa se ve afectada.
          </div>
        </DialogContent>
      </Dialog>

      <ProductCreateDrawer open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
