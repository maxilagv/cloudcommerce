"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, ImageOff, Sparkles } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
  type SelectOption,
} from "@cloudcommerce/ui";
import type { CategoryNode, ProductStatus } from "@cloudcommerce/types";
import { ImageStudioDialog, useSignedMediaUrl } from "@/components/ai/image-studio-dialog";
import { trpc } from "@/lib/trpc";
import { formatDate, formatMinor } from "@/lib/format";
import { slugify } from "@/lib/slug";

function flattenCategories(nodes: CategoryNode[], depth = 0, acc: SelectOption[] = []): SelectOption[] {
  for (const node of nodes) {
    acc.push({ value: node.id, label: `${"— ".repeat(depth)}${node.name}` });
    if (node.children.length) flattenCategories(node.children, depth + 1, acc);
  }
  return acc;
}

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
  const [slug, setSlug] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [imageStudioOpen, setImageStudioOpen] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiEdited, setAiEdited] = useState(false);
  const [aiSeo, setAiSeo] = useState<{ title: string; metaDescription: string; keywords: string[] } | null>(null);

  useEffect(() => {
    if (query.data) {
      setTitle(query.data.title);
      setSubtitle(query.data.subtitle ?? "");
      setDescription(query.data.description);
      setSlug(query.data.slug);
      setSku(query.data.sku ?? "");
      setCategoryId(query.data.category?.id ?? "");
    }
  }, [query.data]);

  const categoriesQuery = useQuery({
    queryKey: ["catalog", "categories", "all"],
    queryFn: () => trpc.catalog.categories.list.query({ includeInactive: true }),
  });
  const categoryOptions = categoriesQuery.data ? flattenCategories(categoriesQuery.data) : [];

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
        slug: slugify(slug.trim() || title),
        sku: sku.trim() || null,
        ...(categoryId ? { categoryId } : {}),
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

  const generateDescription = useMutation({
    mutationFn: () =>
      trpc.ai.generateDescription.mutate({
        productId,
        locale: "es-AR",
        tone: "claro, premium y orientado a conversion",
        maxChars: 1200,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (result) => {
      setAiSeo(null);
      setAiResult(result.text?.text ?? "Generacion duplicada o en proceso. Revisar historial de IA.");
      setAiEdited(false);
      toast({ tone: "success", title: "Descripcion generada" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo generar", message: err instanceof Error ? err.message : undefined }),
  });

  const generateSeo = useMutation({
    mutationFn: () => trpc.ai.generateSeo.mutate({ productId, idempotencyKey: crypto.randomUUID() }),
    onSuccess: (result) => {
      setAiResult("");
      setAiSeo(result.seo ? { title: result.seo.title, metaDescription: result.seo.metaDescription, keywords: result.seo.keywords } : null);
      setAiEdited(false);
      toast({ tone: "success", title: "SEO generado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo generar SEO", message: err instanceof Error ? err.message : undefined }),
  });

  const saveSeo = useMutation({
    mutationFn: () =>
      trpc.catalog.products.update.mutate({
        id: productId,
        seoTitle: aiSeo!.title,
        seoDescription: aiSeo!.metaDescription,
      }),
    onSuccess: () => {
      invalidate();
      toast({ tone: "success", title: "SEO guardado" });
      setAiOpen(false);
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo guardar SEO", message: err instanceof Error ? err.message : undefined }),
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
          <Button variant="secondary" onClick={() => setImageStudioOpen(true)}>
            <Sparkles size={16} /> Imagen IA
          </Button>
          <Button variant="secondary" onClick={() => setAiOpen(true)}>
            <Sparkles size={16} /> Generar con IA
          </Button>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <label className="admin-form-g">
                  <span>Slug (URL en la tienda)</span>
                  <input
                    className="ui-input admin-mono"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    onBlur={() => setSlug((s) => slugify(s || title))}
                  />
                </label>
                <label className="admin-form-g">
                  <span>SKU</span>
                  <input className="ui-input admin-mono" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Opcional" />
                </label>
              </div>
              <label className="admin-form-g">
                <span>Categoría</span>
                {categoryOptions.length === 0 ? (
                  <span className="admin-cell-sub">Cargando categorías…</span>
                ) : (
                  <Select options={categoryOptions} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
                )}
              </label>
              {slug !== p.slug && p.status === ("PUBLISHED" as ProductStatus) && (
                <div className="admin-cell-sub">
                  Ojo: cambiar el slug de un producto publicado cambia su URL en la tienda. El slug
                  anterior queda registrado en el historial.
                </div>
              )}
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
            <div className="admin-panel__h">
              <h3>Imagen principal</h3>
              <Button variant="secondary" size="sm" onClick={() => setImageStudioOpen(true)}>
                <Sparkles size={15} /> Imagen IA
              </Button>
            </div>
            <MainImagePreview mediaAssetId={p.mainImage?.id ?? null} title={p.title} />
          </div>

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

      <ImageStudioDialog
        open={imageStudioOpen}
        onOpenChange={setImageStudioOpen}
        target={{ kind: "product", id: productId, title: p.title, mainImageMediaId: p.mainImage?.id ?? null }}
        onApplied={invalidate}
      />

      <Dialog open={aiOpen} onOpenChange={(open) => !open && setAiOpen(false)}>
        <DialogContent
          title="Generar con IA"
          description="El contenido queda marcado hasta que lo edites o guardes."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cerrar</Button>
              </DialogClose>
              {aiResult && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setDescription(aiResult);
                    setAiOpen(false);
                  }}
                >
                  Usar descripcion
                </Button>
              )}
              {aiSeo && (
                <Button variant="primary" loading={saveSeo.isPending} onClick={() => saveSeo.mutate()}>
                  Guardar SEO
                </Button>
              )}
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Button variant="secondary" loading={generateDescription.isPending} onClick={() => generateDescription.mutate()}>
                Descripcion
              </Button>
              <Button variant="secondary" loading={generateSeo.isPending} onClick={() => generateSeo.mutate()}>
                SEO
              </Button>
              {(aiResult || aiSeo) && <Badge tone={aiEdited ? "warning" : "info"}>{aiEdited ? "Editado" : "Generado con IA"}</Badge>}
            </div>
            {generateDescription.isPending || generateSeo.isPending ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Skeleton height={16} width="80%" />
                <Skeleton height={16} width="65%" />
                <Skeleton height={120} radius={12} />
              </div>
            ) : aiResult ? (
              <textarea
                className="ui-input"
                rows={8}
                value={aiResult}
                onChange={(event) => {
                  setAiResult(event.target.value);
                  setAiEdited(true);
                }}
              />
            ) : aiSeo ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  className="ui-input"
                  value={aiSeo.title}
                  onChange={(event) => {
                    setAiSeo({ ...aiSeo, title: event.target.value });
                    setAiEdited(true);
                  }}
                />
                <textarea
                  className="ui-input"
                  rows={3}
                  value={aiSeo.metaDescription}
                  onChange={(event) => {
                    setAiSeo({ ...aiSeo, metaDescription: event.target.value });
                    setAiEdited(true);
                  }}
                />
                <div className="admin-cell-sub">{aiSeo.keywords.join(", ")}</div>
              </div>
            ) : (
              <div className="admin-empty" style={{ padding: "28px 0" }}>Elegi una generacion para empezar.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MainImagePreview({ mediaAssetId, title }: { mediaAssetId: string | null; title: string }) {
  const url = useSignedMediaUrl(mediaAssetId);

  if (!mediaAssetId) {
    return <div className="admin-cell-sub">Sin imagen principal. Generá una con el estudio de imagen IA.</div>;
  }

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid var(--admin-border-default)",
        overflow: "hidden",
        minHeight: 140,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {url.isLoading ? (
        <Skeleton height={140} radius={0} />
      ) : url.data ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url.data} alt={title} style={{ width: "100%", maxHeight: 220, objectFit: "contain" }} />
      ) : (
        <span className="admin-cell-sub" style={{ padding: 20, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ImageOff size={15} /> No se pudo cargar la imagen
        </span>
      )}
    </div>
  );
}
