"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Skeleton,
  StatusBadge,
  useToast,
} from "@cloudcommerce/ui";
import type { ProductStatus } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatDate, formatMinor } from "@/lib/format";

const STATUSES: ProductStatus[] = ["DRAFT", "READY_FOR_REVIEW", "PUBLISHED", "PAUSED", "ARCHIVED"] as ProductStatus[];

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["catalog", "product", productId],
    queryFn: () => trpc.catalog.products.byId.query({ productId }),
    retry: false,
  });

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (query.data) {
      setTitle(query.data.title);
      setSubtitle(query.data.subtitle ?? "");
      setDescription(query.data.description);
    }
  }, [query.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["catalog", "product", productId] });
    qc.invalidateQueries({ queryKey: ["catalog", "products"] });
  };

  const save = useMutation({
    mutationFn: () =>
      trpc.catalog.products.update.mutate({
        id: productId,
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        description: description.trim(),
      }),
    onSuccess: () => {
      invalidate();
      toast({ tone: "success", title: "Cambios guardados" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo guardar", message: err instanceof Error ? err.message : undefined }),
  });

  const changeStatus = useMutation({
    mutationFn: (status: ProductStatus) => trpc.catalog.products.setStatus.mutate({ productId, status }),
    onSuccess: () => {
      invalidate();
      toast({ tone: "success", title: "Estado actualizado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo cambiar el estado", message: err instanceof Error ? err.message : undefined }),
  });

  if (query.isLoading) {
    return (
      <div className="admin-view">
        <Skeleton height={30} width={220} />
        <div style={{ marginTop: 20 }}>
          <Skeleton height={280} radius={14} />
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="admin-view">
        <div className="admin-panel admin-empty">
          <h4>Producto no encontrado</h4>
          <Button variant="secondary" onClick={() => router.push("/productos")} style={{ marginTop: 12 }}>
            Volver a productos
          </Button>
        </div>
      </div>
    );
  }

  const p = query.data;

  return (
    <div className="admin-view">
      <button className="admin-back" onClick={() => router.push("/productos")}>
        <ArrowLeft size={16} /> Volver a productos
      </button>

      <div className="admin-ph">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <h1>{p.title}</h1>
          <StatusBadge status={p.status} />
        </div>
        <div className="admin-ph__actions">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Cambiar estado</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Estado del producto</DropdownMenuLabel>
              {STATUSES.map((s) => (
                <DropdownMenuItem key={s} onSelect={() => changeStatus.mutate(s)}>
                  <StatusBadge status={s} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
            <Check size={16} /> Guardar cambios
          </Button>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-panel">
            <div className="admin-panel__h">
              <h3>Información general</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label className="admin-form-g">
                <span>Nombre</span>
                <input className="ui-input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>
              <label className="admin-form-g">
                <span>Subtítulo</span>
                <input className="ui-input" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Opcional" />
              </label>
              <label className="admin-form-g">
                <span>Descripción</span>
                <textarea className="ui-input" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel__h">
              <h3>Variantes</h3>
              <span className="admin-cell-sub" style={{ margin: 0 }}>{p.variants.length} variante(s)</span>
            </div>
            {p.variants.length === 0 ? (
              <div className="admin-cell-sub">Sin variantes cargadas.</div>
            ) : (
              <table className="ui-table">
                <thead>
                  <tr>
                    <th>Variante</th>
                    <th>SKU</th>
                    <th style={{ textAlign: "right" }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {p.variants.map((v) => (
                    <tr key={v.id}>
                      <td className="admin-cell-str">{v.title}</td>
                      <td className="admin-mono">{v.sku}</td>
                      <td style={{ textAlign: "right" }}>
                        <StatusBadge status={v.isActive ? "IN_STOCK" : "ARCHIVED"} label={v.isActive ? "Activa" : "Inactiva"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-panel">
            <div className="sc-lbl">Precio y stock</div>
            <div className="admin-detail-kv">
              <span>Precio</span>
              <b className="admin-mono">{p.price ? formatMinor(p.price.amountMinor) : "—"}</b>
            </div>
            <div className="admin-detail-kv">
              <span>Comparar en</span>
              <b className="admin-mono">{p.compareAtPrice ? formatMinor(p.compareAtPrice.amountMinor) : "—"}</b>
            </div>
            <div className="admin-detail-kv">
              <span>Stock</span>
              <StatusBadge status={p.stockStatus} />
            </div>
          </div>

          <div className="admin-panel">
            <div className="sc-lbl">Metadatos</div>
            <div className="admin-detail-kv">
              <span>Categoría</span>
              <b>{p.category?.name ?? "—"}</b>
            </div>
            <div className="admin-detail-kv">
              <span>Slug</span>
              <b className="admin-mono" style={{ fontSize: 12 }}>{p.slug}</b>
            </div>
            <div className="admin-detail-kv">
              <span>Actualizado</span>
              <b>{formatDate(p.updatedAt)}</b>
            </div>
            <div className="admin-detail-kv">
              <span>Publicado</span>
              <b>{p.publishedAt ? formatDate(p.publishedAt) : "—"}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
