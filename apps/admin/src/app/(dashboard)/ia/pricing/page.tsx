"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, Search, Sparkles, Tag, TriangleAlert } from "lucide-react";
import {
  Badge,
  Button,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
  type SelectOption,
} from "@cloudcommerce/ui";
import {
  AiGenerationStatus,
  type AiPriceSuggestion,
  type CategoryNode,
  type ProductCard,
  type ProductVariantResponse,
} from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatMinor } from "@/lib/format";

type Mode = "variant" | "category";

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

function variantLabel(variant: ProductVariantResponse): string {
  return `${variant.title} - ${variant.sku}`;
}

function newKey(): string {
  return crypto.randomUUID();
}

export default function AiPricingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("variant");
  const [productQuery, setProductQuery] = useState("");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<AiGenerationStatus | null>(null);
  const [suggestions, setSuggestions] = useState<AiPriceSuggestion[]>([]);

  const products = useQuery({
    queryKey: ["ai", "pricing", "products", productQuery],
    queryFn: () =>
      trpc.catalog.products.search.query({
        limit: 20,
        sort: "title_asc",
        ...(productQuery.trim() ? { query: productQuery.trim() } : {}),
      }),
    enabled: mode === "variant",
  });

  const product = useQuery({
    queryKey: ["ai", "pricing", "product", productId],
    queryFn: () => trpc.catalog.products.byId.query({ productId }),
    enabled: mode === "variant" && productId.length > 0,
    retry: false,
  });

  const categories = useQuery({
    queryKey: ["ai", "pricing", "categories"],
    queryFn: () => trpc.catalog.categories.list.query({ includeInactive: true }),
    enabled: mode === "category",
  });
  const categoryOptions = useMemo(() => flattenCategories(categories.data ?? []), [categories.data]);

  const optimize = useMutation({
    mutationFn: () =>
      trpc.ai.optimizePricing.mutate({
        ...(mode === "variant" ? { variantId } : { categoryId }),
        idempotencyKey: newKey(),
      }),
    onSuccess: (response) => {
      setStatus(response.status);
      setSuggestions(response.suggestions);
      qc.invalidateQueries({ queryKey: ["ai"] });
      toast({ tone: "success", title: "Sugerencias generadas" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo optimizar", message: err instanceof Error ? err.message : undefined }),
  });

  const canGenerate = mode === "variant" ? variantId.length > 0 : categoryId.length > 0;

  return (
    <div className="admin-view">
      <Link className="admin-back" href="/ia">
        <ArrowLeft size={16} /> Volver a IA
      </Link>

      <div className="admin-ph">
        <div>
          <h1>Pricing IA</h1>
          <div className="admin-ph__sub">Sugerencias por variante o categoria con control de margen minimo.</div>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Parametro de optimizacion</h3>
            <div className="admin-segs">
              <button
                data-on={mode === "variant" || undefined}
                onClick={() => {
                  setMode("variant");
                  setCategoryId("");
                }}
              >
                Variante
              </button>
              <button
                data-on={mode === "category" || undefined}
                onClick={() => {
                  setMode("category");
                  setProductId("");
                  setVariantId("");
                }}
              >
                Categoria
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {mode === "variant" ? (
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
                    onChange={(event) => {
                      setProductId(event.target.value);
                      setVariantId("");
                    }}
                    options={[
                      { value: "", label: products.isLoading ? "Cargando productos..." : "Seleccionar producto" },
                      ...(products.data?.items.map((item) => ({ value: item.id, label: productLabel(item) })) ?? []),
                    ]}
                  />
                </label>
                <label className="admin-form-g">
                  <span>Variante</span>
                  <Select
                    value={variantId}
                    disabled={!product.data}
                    onChange={(event) => setVariantId(event.target.value)}
                    options={[
                      { value: "", label: product.isLoading ? "Cargando variantes..." : "Seleccionar variante" },
                      ...(product.data?.variants.map((item) => ({ value: item.id, label: variantLabel(item) })) ?? []),
                    ]}
                  />
                </label>
              </>
            ) : (
              <label className="admin-form-g">
                <span>Categoria</span>
                <Select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  options={[{ value: "", label: categories.isLoading ? "Cargando categorias..." : "Seleccionar categoria" }, ...categoryOptions]}
                />
              </label>
            )}

            <Button variant="primary" loading={optimize.isPending} disabled={!canGenerate} onClick={() => optimize.mutate()}>
              <Sparkles size={16} /> Generar sugerencias
            </Button>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Resultado</h3>
            {status && <StatusBadge status={status} />}
          </div>
          {optimize.isPending ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton height={16} width="75%" />
              <Skeleton height={16} width="55%" />
              <Skeleton height={140} radius={12} />
            </div>
          ) : suggestions.length === 0 ? (
            <div className="admin-empty" style={{ padding: "54px 0" }}>
              <Tag size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
              Genera una sugerencia para revisar precios.
            </div>
          ) : (
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Variante</th>
                  <th>Precio sugerido</th>
                  <th>Margen</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((item) => (
                  <tr key={item.variantId}>
                    <td>
                      <span className="admin-cell-str admin-mono">{item.variantId}</span>
                      <span className="admin-cell-sub">{item.rationale}</span>
                    </td>
                    <td className="admin-mono">{formatMinor(item.suggestedAmountMinor)}</td>
                    <td className="admin-mono">{item.marginPct.toFixed(1)}%</td>
                    <td>
                      {item.withinMinMargin ? (
                        <Badge tone="success">Margen OK</Badge>
                      ) : (
                        <Badge tone="warning"><TriangleAlert size={13} /> Bajo minimo</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
