"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, FileText, Search, Sparkles, Wand2 } from "lucide-react";
import {
  Badge,
  Button,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
  type SelectOption,
} from "@cloudcommerce/ui";
import { AiGenerationStatus, type CategoryNode, type ProductCard } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatMinor } from "@/lib/format";

type Tool = "description" | "specs" | "seo";
type SeoMode = "product" | "category";

function flattenCategories(nodes: CategoryNode[], depth = 0, acc: SelectOption[] = []): SelectOption[] {
  for (const node of nodes) {
    acc.push({ value: node.id, label: `${"  ".repeat(depth)}${node.name}` });
    flattenCategories(node.children, depth + 1, acc);
  }
  return acc;
}

function productLabel(product: ProductCard): string {
  return `${product.title}${product.sku ? ` - ${product.sku}` : ""}`;
}

function newKey(): string {
  return crypto.randomUUID();
}

export default function AiTextToolsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tool, setTool] = useState<Tool>("description");
  const [productQuery, setProductQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [seoMode, setSeoMode] = useState<SeoMode>("product");
  const [locale, setLocale] = useState("es-AR");
  const [tone, setTone] = useState("claro, premium y orientado a conversion");
  const [maxChars, setMaxChars] = useState("1200");
  const [sourceHints, setSourceHints] = useState("");
  const [result, setResult] = useState("");
  const [edited, setEdited] = useState(false);
  const [resultStatus, setResultStatus] = useState<AiGenerationStatus | null>(null);
  const [usageLabel, setUsageLabel] = useState("");

  const products = useQuery({
    queryKey: ["ai", "products", productQuery],
    queryFn: () =>
      trpc.catalog.products.search.query({
        limit: 20,
        sort: "title_asc",
        ...(productQuery.trim() ? { query: productQuery.trim() } : {}),
      }),
  });

  const categories = useQuery({
    queryKey: ["ai", "categories"],
    queryFn: () => trpc.catalog.categories.list.query({ includeInactive: true }),
  });

  const categoryOptions = useMemo(() => flattenCategories(categories.data ?? []), [categories.data]);

  function setGenerated(text: string, status: AiGenerationStatus, costMinor?: number) {
    setResult(text);
    setEdited(false);
    setResultStatus(status);
    setUsageLabel(costMinor !== undefined ? formatMinor(costMinor) : "");
    qc.invalidateQueries({ queryKey: ["ai"] });
  }

  const description = useMutation({
    mutationFn: () =>
      trpc.ai.generateDescription.mutate({
        productId,
        locale,
        tone: tone.trim() || undefined,
        maxChars: Math.max(200, Math.min(5000, Number(maxChars) || 1200)),
        idempotencyKey: newKey(),
      }),
    onSuccess: (response) => {
      if (response.text) {
        setGenerated(response.text.text, response.status, response.text.usage.costMinor);
      } else {
        setGenerated("Generacion duplicada o todavia en proceso. Revisar historial.", response.status);
      }
      toast({ tone: "success", title: "Descripcion generada" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo generar", message: err instanceof Error ? err.message : undefined }),
  });

  const specs = useMutation({
    mutationFn: () =>
      trpc.ai.generateSpecs.mutate({
        productId,
        sourceHints: sourceHints.trim() || undefined,
        idempotencyKey: newKey(),
      }),
    onSuccess: (response) => {
      if (response.specs) {
        const text = response.specs.groups
          .map((group) => `${group.name}\n${group.items.map((item) => `- ${item.label}: ${item.valueText ?? item.valueNum ?? ""}${item.unit ? ` ${item.unit}` : ""}`).join("\n")}`)
          .join("\n\n");
        setGenerated(text, response.status, response.specs.usage.costMinor);
      } else {
        setGenerated("Generacion duplicada o todavia en proceso. Revisar historial.", response.status);
      }
      toast({ tone: "success", title: "Specs generadas" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudieron generar specs", message: err instanceof Error ? err.message : undefined }),
  });

  const seo = useMutation({
    mutationFn: () =>
      trpc.ai.generateSeo.mutate({
        ...(seoMode === "product" ? { productId } : { categoryId }),
        idempotencyKey: newKey(),
      }),
    onSuccess: (response) => {
      if (response.seo) {
        setGenerated(
          `Titulo: ${response.seo.title}\nMeta: ${response.seo.metaDescription}\nKeywords: ${response.seo.keywords.join(", ")}`,
          response.status,
          response.seo.usage.costMinor,
        );
      } else {
        setGenerated("Generacion duplicada o todavia en proceso. Revisar historial.", response.status);
      }
      toast({ tone: "success", title: "SEO generado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo generar SEO", message: err instanceof Error ? err.message : undefined }),
  });

  const isLoading = description.isPending || specs.isPending || seo.isPending;
  const canGenerate =
    (tool === "description" && productId.length > 0) ||
    (tool === "specs" && productId.length > 0) ||
    (tool === "seo" && ((seoMode === "product" && productId.length > 0) || (seoMode === "category" && categoryId.length > 0)));

  function generate() {
    setResult("");
    setResultStatus(null);
    if (tool === "description") description.mutate();
    if (tool === "specs") specs.mutate();
    if (tool === "seo") seo.mutate();
  }

  return (
    <div className="admin-view">
      <Link className="admin-back" href="/ia">
        <ArrowLeft size={16} /> Volver a IA
      </Link>

      <div className="admin-ph">
        <div>
          <h1>Textos y SEO con IA</h1>
          <div className="admin-ph__sub">Descripcion, especificaciones y SEO editables antes de aplicar.</div>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Parametros</h3>
            <div className="admin-segs">
              <button data-on={tool === "description" || undefined} onClick={() => setTool("description")}>Descripcion</button>
              <button data-on={tool === "specs" || undefined} onClick={() => setTool("specs")}>Specs</button>
              <button data-on={tool === "seo" || undefined} onClick={() => setTool("seo")}>SEO</button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {(tool === "description" || tool === "specs" || seoMode === "product") && (
              <>
                <label className="admin-form-g">
                  <span>Buscar producto</span>
                  <span className="ui-input-wrap">
                    <span className="ui-input__lead"><Search size={15} /></span>
                    <input className="ui-input ui-input--lead" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Nombre, SKU o slug" />
                  </span>
                </label>
                <label className="admin-form-g">
                  <span>Producto</span>
                  <Select
                    value={productId}
                    onChange={(event) => setProductId(event.target.value)}
                    options={[
                      { value: "", label: products.isLoading ? "Cargando productos..." : "Seleccionar producto" },
                      ...(products.data?.items.map((item) => ({ value: item.id, label: productLabel(item) })) ?? []),
                    ]}
                  />
                </label>
              </>
            )}

            {tool === "seo" && (
              <>
                <div className="admin-segs">
                  <button
                    data-on={seoMode === "product" || undefined}
                    onClick={() => {
                      setSeoMode("product");
                      setCategoryId("");
                    }}
                  >
                    Producto
                  </button>
                  <button
                    data-on={seoMode === "category" || undefined}
                    onClick={() => {
                      setSeoMode("category");
                      setProductId("");
                    }}
                  >
                    Categoria
                  </button>
                </div>
                {seoMode === "category" && (
                  <label className="admin-form-g">
                    <span>Categoria</span>
                    <Select
                      value={categoryId}
                      onChange={(event) => setCategoryId(event.target.value)}
                      options={[{ value: "", label: categories.isLoading ? "Cargando categorias..." : "Seleccionar categoria" }, ...categoryOptions]}
                    />
                  </label>
                )}
              </>
            )}

            {tool === "description" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <label className="admin-form-g">
                    <span>Locale</span>
                    <input className="ui-input admin-mono" value={locale} onChange={(event) => setLocale(event.target.value)} />
                  </label>
                  <label className="admin-form-g">
                    <span>Max caracteres</span>
                    <input className="ui-input admin-mono" type="number" value={maxChars} onChange={(event) => setMaxChars(event.target.value)} />
                  </label>
                </div>
                <label className="admin-form-g">
                  <span>Tono</span>
                  <input className="ui-input" value={tone} onChange={(event) => setTone(event.target.value)} />
                </label>
              </>
            )}

            {tool === "specs" && (
              <label className="admin-form-g">
                <span>Hints de origen</span>
                <textarea className="ui-input" rows={5} value={sourceHints} onChange={(event) => setSourceHints(event.target.value)} placeholder="Datos crudos, ficha tecnica, notas del proveedor..." />
              </label>
            )}

            <Button variant="primary" loading={isLoading} disabled={!canGenerate} onClick={generate}>
              <Sparkles size={16} /> Generar
            </Button>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Resultado</h3>
            {resultStatus && <StatusBadge status={resultStatus} label={edited ? "Editado" : "Generado con IA"} />}
          </div>
          {isLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton height={16} width="85%" />
              <Skeleton height={16} width="70%" />
              <Skeleton height={120} radius={12} />
            </div>
          ) : result ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {usageLabel && <Badge tone="info">Costo {usageLabel}</Badge>}
              <textarea
                className="ui-input"
                rows={14}
                value={result}
                onChange={(event) => {
                  setResult(event.target.value);
                  setEdited(true);
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" onClick={generate}><Wand2 size={16} /> Regenerar</Button>
                <Button variant="primary" disabled><Check size={16} /> Usar este contenido</Button>
              </div>
            </div>
          ) : (
            <div className="admin-empty" style={{ padding: "54px 0" }}>
              <FileText size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
              Genera contenido para revisarlo y editarlo aca.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
