"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Package, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  type ColumnDef,
} from "@cloudcommerce/ui";
import {
  PriceOrigin,
  PricingScope,
  PricingValueKind,
  type Currency,
  type DiscountResponse,
  type ProductCard,
} from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatDate, formatMinor } from "@/lib/format";
import { ResalePanels } from "@/components/pricing/resale-panels";

const CURRENCIES: Currency[] = ["ARS", "USD"];
const SCOPE_OPTIONS = [
  { value: PricingScope.GLOBAL, label: "Global" },
  { value: PricingScope.CATEGORY, label: "Categoria" },
  { value: PricingScope.PRODUCT, label: "Producto" },
];
const KIND_OPTIONS = [
  { value: PricingValueKind.PERCENT, label: "Porcentaje" },
  { value: PricingValueKind.FIXED, label: "Monto fijo" },
];

function moneyToMinor(value: string): number {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function percentToBps(value: string): number {
  const parsed = Number(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed * 100);
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function moneyLabel(amountMinor: number, currency: Currency): string {
  if (currency === "ARS") return formatMinor(amountMinor);
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD" }).format(amountMinor / 100);
}

function scopeLabel(scope: PricingScope): string {
  if (scope === PricingScope.GLOBAL) return "Global";
  if (scope === PricingScope.CATEGORY) return "Categoria";
  return "Producto";
}

function kindValueLabel(kind: PricingValueKind, value: number, currency: Currency = "ARS"): string {
  return kind === PricingValueKind.PERCENT ? `${(value / 100).toLocaleString("es-AR")}%` : moneyLabel(value, currency);
}

function productScopeId(product: ProductCard | null, scope: PricingScope): string {
  if (!product) return "";
  if (scope === PricingScope.PRODUCT) return product.id;
  if (scope === PricingScope.CATEGORY) return product.category?.id ?? "";
  return "";
}

export default function PricingPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [codeSearch, setCodeSearch] = useState("");
  const [creatingDiscount, setCreatingDiscount] = useState(false);
  const [discountTarget, setDiscountTarget] = useState<DiscountResponse | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [currency, setCurrency] = useState<Currency>("ARS");

  const discounts = useQuery({
    queryKey: ["pricing", "discounts", includeInactive, codeSearch.trim()],
    queryFn: () =>
      trpc.pricing.discounts.list.query({
        includeInactive,
        ...(codeSearch.trim().length >= 3 ? { code: codeSearch.trim().toUpperCase() } : {}),
      }),
    retry: false,
  });

  const products = useQuery({
    queryKey: ["pricing", "products", productQuery],
    queryFn: () =>
      trpc.catalog.products.search.query({
        limit: 12,
        sort: "title_asc",
        ...(productQuery.trim() ? { query: productQuery.trim() } : {}),
      }),
  });

  const selectedProduct = useQuery({
    queryKey: ["pricing", "product", selectedProductId],
    queryFn: () => trpc.catalog.products.byId.query({ productId: selectedProductId }),
    enabled: selectedProductId.length > 0,
    retry: false,
  });

  const breakdown = useQuery({
    queryKey: ["pricing", "breakdown", selectedVariantId, currency],
    queryFn: () => trpc.pricing.computeSalePrice.query({ variantId: selectedVariantId, currency }),
    enabled: selectedVariantId.length > 0,
    retry: false,
  });

  useEffect(() => {
    setSelectedVariantId("");
  }, [selectedProductId]);

  useEffect(() => {
    const first = selectedProduct.data?.variants[0]?.id;
    if (first && !selectedVariantId) setSelectedVariantId(first);
  }, [selectedProduct.data, selectedVariantId]);

  const invalidatePricing = () => {
    qc.invalidateQueries({ queryKey: ["pricing"] });
    qc.invalidateQueries({ queryKey: ["catalog", "products"] });
  };

  const deactivateDiscount = useMutation({
    mutationFn: (id: string) => trpc.pricing.discounts.deactivate.mutate({ id }),
    onSuccess: () => {
      invalidatePricing();
      toast({ tone: "success", title: "Descuento desactivado" });
      setDiscountTarget(null);
    },
    onError: (err) =>
      toast({ tone: "error", title: "No se pudo desactivar", message: err instanceof Error ? err.message : undefined }),
  });

  const columns = useMemo<ColumnDef<DiscountResponse, unknown>[]>(
    () => [
      {
        id: "code",
        header: "Codigo",
        cell: ({ row }) => (
          <span>
            <span className="admin-cell-str admin-mono">{row.original.code ?? "sin codigo"}</span>
            <span className="admin-cell-sub">{row.original.id}</span>
          </span>
        ),
      },
      {
        id: "scope",
        header: "Alcance",
        cell: ({ row }) => <Badge tone="info">{scopeLabel(row.original.scope)}</Badge>,
      },
      {
        id: "kind",
        header: "Tipo",
        cell: ({ row }) => kindValueLabel(row.original.kind, row.original.value),
      },
      {
        id: "validity",
        header: "Vigencia",
        cell: ({ row }) => (
          <span className="admin-cell-sub">
            {formatDate(row.original.validFrom)}
            {" -> "}
            {row.original.validTo ? formatDate(row.original.validTo) : "sin vencimiento"}
          </span>
        ),
      },
      {
        id: "uses",
        header: "Usos",
        cell: ({ row }) => (
          <span className="admin-mono">
            {row.original.usedCount}
            {row.original.maxUses ? ` / ${row.original.maxUses}` : ""}
          </span>
        ),
      },
      {
        id: "status",
        header: "Estado",
        cell: ({ row }) => (
          <Badge tone={row.original.isActive ? "success" : "muted"}>{row.original.isActive ? "Activo" : "Inactivo"}</Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            disabled={!row.original.isActive}
            onClick={(event) => {
              event.stopPropagation();
              setDiscountTarget(row.original);
            }}
          >
            <Trash2 size={15} /> Desactivar
          </Button>
        ),
      },
    ],
    [],
  );

  const productItems = products.data?.items ?? [];
  const activeProduct = selectedProduct.data ?? productItems.find((item) => item.id === selectedProductId) ?? null;
  const activeVariant = selectedProduct.data?.variants.find((variant) => variant.id === selectedVariantId) ?? null;

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Pricing</h1>
          <div className="admin-ph__sub">Reglas, descuentos y simulacion de margen por variante</div>
        </div>
        <div className="admin-ph__actions">
          <Button variant="primary" onClick={() => setCreatingDiscount(true)}>
            <Plus size={16} /> Nuevo descuento
          </Button>
        </div>
      </div>

      <div className="admin-grid admin-grid--2">
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Simulador de margen</h3>
            <div className="admin-segs">
              {CURRENCIES.map((item) => (
                <button key={item} data-on={currency === item || undefined} onClick={() => setCurrency(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="admin-form-g">
              <span>Buscar producto</span>
              <span className="ui-input-wrap">
                <span className="ui-input__lead" aria-hidden>
                  <Search size={15} />
                </span>
                <input
                  className="ui-input ui-input--lead"
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder="Nombre, SKU o slug"
                />
              </span>
            </label>

            <label className="admin-form-g">
              <span>Producto</span>
              <Select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                options={[
                  { value: "", label: products.isLoading ? "Cargando productos..." : "Seleccionar producto" },
                  ...productItems.map((item) => ({ value: item.id, label: `${item.title}${item.sku ? ` - ${item.sku}` : ""}` })),
                ]}
              />
            </label>

            <label className="admin-form-g">
              <span>Variante</span>
              <Select
                value={selectedVariantId}
                disabled={!selectedProduct.data || selectedProduct.data.variants.length === 0}
                onChange={(event) => setSelectedVariantId(event.target.value)}
                options={[
                  { value: "", label: selectedProduct.isLoading ? "Cargando variantes..." : "Seleccionar variante" },
                  ...(selectedProduct.data?.variants.map((item) => ({ value: item.id, label: `${item.title} - ${item.sku}` })) ?? []),
                ]}
              />
            </label>
          </div>

          <div style={{ marginTop: 18 }}>
            {breakdown.isLoading ? (
              <Skeleton height={180} radius={12} />
            ) : !selectedVariantId ? (
              <div className="admin-empty" style={{ padding: "34px 0" }}>
                <Calculator size={34} style={{ opacity: 0.5, marginBottom: 10 }} />
                Selecciona una variante para calcular el precio.
              </div>
            ) : breakdown.isError || !breakdown.data ? (
              <div className="admin-empty" style={{ padding: "34px 0" }}>No disponible para tu rol</div>
            ) : (
              <PriceBreakdownPanel breakdown={breakdown.data} currency={currency} productTitle={activeProduct?.title} variantTitle={activeVariant?.title} />
            )}
          </div>
        </div>

        <VariantPricingForms
          variantId={selectedVariantId}
          currency={currency}
          product={activeProduct}
          onSaved={invalidatePricing}
        />
      </div>

      <div className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel__h">
          <h3>Regla activa mostrada por el simulador</h3>
        </div>
        {breakdown.data && "supplierCost" in breakdown.data && breakdown.data.markupRule ? (
          <div className="admin-detail-kv">
            <span>
              {scopeLabel(breakdown.data.markupRule.scope)} · {breakdown.data.markupRule.scopeId ?? "sin scopeId"}
            </span>
            <b className="admin-mono">{kindValueLabel(breakdown.data.markupRule.kind, breakdown.data.markupRule.value, currency)}</b>
          </div>
        ) : breakdown.data && !("supplierCost" in breakdown.data) ? (
          <div className="admin-empty" style={{ padding: "28px 0" }}>No disponible para tu rol</div>
        ) : (
          <div className="admin-cell-sub">La regla aplicable aparece cuando el simulador tiene una variante calculada.</div>
        )}
      </div>

      <ResalePanels />

      <div className="admin-tbl-card" style={{ marginTop: 16 }}>
        <div className="admin-toolbar">
          <div className="admin-field" style={{ minWidth: 220 }}>
            <Search size={15} />
            <input placeholder="Codigo de descuento" value={codeSearch} onChange={(event) => setCodeSearch(event.target.value)} />
          </div>
          <span className="admin-chip" data-on={!includeInactive || undefined} onClick={() => setIncludeInactive(false)}>
            Activos
          </span>
          <span className="admin-chip" data-on={includeInactive || undefined} onClick={() => setIncludeInactive(true)}>
            Incluir inactivos
          </span>
        </div>
        {discounts.isError ? (
          <div className="admin-empty">No disponible para tu rol</div>
        ) : (
          <DataTable
            columns={columns}
            data={discounts.data ?? []}
            loading={discounts.isLoading}
            emptyState={
              <div>
                <Tag size={38} style={{ opacity: 0.5, marginBottom: 12 }} />
                <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin descuentos</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>Crea un descuento para verlo en esta lista.</div>
              </div>
            }
          />
        )}
      </div>

      <DiscountDialog
        open={creatingDiscount}
        onClose={() => setCreatingDiscount(false)}
        onSaved={invalidatePricing}
        product={activeProduct}
      />

      <Dialog open={discountTarget !== null} onOpenChange={(open) => !open && setDiscountTarget(null)}>
        <DialogContent
          title="Desactivar descuento"
          description={discountTarget?.code ?? discountTarget?.id}
          tone="danger"
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={deactivateDiscount.isPending}
                onClick={() => discountTarget && deactivateDiscount.mutate(discountTarget.id)}
              >
                Desactivar
              </Button>
            </>
          }
        >
          <div className="admin-cell-sub">El descuento deja de aplicarse en nuevas ventas. Los usos historicos se conservan.</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PriceBreakdownPanel({
  breakdown,
  currency,
  productTitle,
  variantTitle,
}: {
  breakdown: Awaited<ReturnType<typeof trpc.pricing.computeSalePrice.query>>;
  currency: Currency;
  productTitle?: string;
  variantTitle?: string;
}) {
  const internal = "supplierCost" in breakdown ? breakdown : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="admin-detail-kv">
        <span>Producto</span>
        <b>{productTitle ?? "Producto seleccionado"}</b>
      </div>
      <div className="admin-detail-kv">
        <span>Variante</span>
        <b>{variantTitle ?? breakdown.variantId}</b>
      </div>
      <div className="admin-detail-kv">
        <span>Precio resultante</span>
        <b className="admin-mono">{moneyLabel(breakdown.price.amountMinor, breakdown.price.currency)}</b>
      </div>
      <div className="admin-detail-kv">
        <span>Origen</span>
        <StatusBadge status={breakdown.origin === PriceOrigin.MANUAL ? "PAUSED" : "PUBLISHED"} label={breakdown.origin === PriceOrigin.MANUAL ? "Manual" : "Computado"} />
      </div>
      {breakdown.compareAtPrice && (
        <div className="admin-detail-kv">
          <span>Comparar en</span>
          <b className="admin-mono">{moneyLabel(breakdown.compareAtPrice.amountMinor, breakdown.compareAtPrice.currency)}</b>
        </div>
      )}
      {internal ? (
        <>
          <div className="admin-detail-kv">
            <span>Costo proveedor</span>
            <b className="admin-mono">{moneyLabel(internal.supplierCost.amountMinor, internal.supplierCost.currency)}</b>
          </div>
          <div className="admin-detail-kv">
            <span>Margen</span>
            <b className="admin-mono" style={{ color: internal.marginMinor >= 0 ? "var(--admin-success)" : "var(--admin-danger)" }}>
              {moneyLabel(internal.marginMinor, currency)} · {(internal.marginBps / 100).toLocaleString("es-AR")}%
            </b>
          </div>
        </>
      ) : (
        <div className="admin-empty" style={{ padding: "18px 0" }}>No disponible para tu rol</div>
      )}
    </div>
  );
}

function VariantPricingForms({
  variantId,
  currency,
  product,
  onSaved,
}: {
  variantId: string;
  currency: Currency;
  product: ProductCard | null;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [costAmount, setCostAmount] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [costValidFrom, setCostValidFrom] = useState(todayInput());
  const [priceAmount, setPriceAmount] = useState("");
  const [compareAt, setCompareAt] = useState("");
  const [priceValidFrom, setPriceValidFrom] = useState(todayInput());
  const [priceValidTo, setPriceValidTo] = useState("");
  const [scope, setScope] = useState<PricingScope>(PricingScope.GLOBAL);
  const [scopeId, setScopeId] = useState("");
  const [kind, setKind] = useState<PricingValueKind>(PricingValueKind.PERCENT);
  const [ruleValue, setRuleValue] = useState("");
  const [minMargin, setMinMargin] = useState("");

  useEffect(() => {
    setScopeId(productScopeId(product, scope));
  }, [product, scope]);

  const cost = useMutation({
    mutationFn: () =>
      trpc.pricing.setSupplierCost.mutate({
        variantId,
        supplierId: supplierId.trim() || null,
        costAmountMinor: moneyToMinor(costAmount),
        currency,
        validFrom: new Date(costValidFrom),
      }),
    onSuccess: () => {
      onSaved();
      toast({ tone: "success", title: "Costo guardado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo guardar el costo", message: err instanceof Error ? err.message : undefined }),
  });

  const manualPrice = useMutation({
    mutationFn: () =>
      trpc.pricing.setManualPrice.mutate({
        variantId,
        amountMinor: moneyToMinor(priceAmount),
        currency,
        compareAtAmountMinor: compareAt.trim() ? moneyToMinor(compareAt) : null,
        validFrom: new Date(priceValidFrom),
        ...(priceValidTo ? { validTo: new Date(priceValidTo) } : {}),
      }),
    onSuccess: () => {
      onSaved();
      toast({ tone: "success", title: "Precio manual guardado" });
    },
    onError: (err) =>
      toast({ tone: "error", title: "No se pudo guardar el precio", message: err instanceof Error ? err.message : undefined }),
  });

  const markupRule = useMutation({
    mutationFn: () =>
      trpc.pricing.setMarkupRule.mutate({
        scope,
        ...(scope === PricingScope.GLOBAL ? {} : { scopeId: scopeId.trim() }),
        kind,
        value: kind === PricingValueKind.PERCENT ? percentToBps(ruleValue) : moneyToMinor(ruleValue),
        minMarginBps: minMargin.trim() ? percentToBps(minMargin) : null,
      }),
    onSuccess: () => {
      onSaved();
      toast({ tone: "success", title: "Regla de markup guardada" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo guardar la regla", message: err instanceof Error ? err.message : undefined }),
  });

  const needsScopeId = scope !== PricingScope.GLOBAL;
  const canSaveCost = variantId.length > 0 && moneyToMinor(costAmount) > 0;
  const canSaveManual = variantId.length > 0 && moneyToMinor(priceAmount) > 0;
  const canSaveRule = (scope === PricingScope.GLOBAL || scopeId.trim().length > 0) && ruleValue.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="admin-panel">
        <div className="admin-panel__h">
          <h3>Costo de proveedor</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="admin-form-g">
            <span>Monto ({currency})</span>
            <input className="ui-input admin-mono" value={costAmount} onChange={(event) => setCostAmount(event.target.value)} placeholder="0,00" />
          </label>
          <label className="admin-form-g">
            <span>Proveedor (opcional)</span>
            <input className="ui-input admin-mono" value={supplierId} onChange={(event) => setSupplierId(event.target.value)} placeholder="UUID proveedor" />
          </label>
          <label className="admin-form-g">
            <span>Vigente desde</span>
            <input className="ui-input admin-mono" type="date" value={costValidFrom} onChange={(event) => setCostValidFrom(event.target.value)} />
          </label>
          <Button variant="primary" loading={cost.isPending} disabled={!canSaveCost} onClick={() => cost.mutate()}>
            Guardar costo
          </Button>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel__h">
          <h3>Precio manual</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="admin-form-g">
            <span>Precio ({currency})</span>
            <input className="ui-input admin-mono" value={priceAmount} onChange={(event) => setPriceAmount(event.target.value)} placeholder="0,00" />
          </label>
          <label className="admin-form-g">
            <span>Comparar en (opcional)</span>
            <input className="ui-input admin-mono" value={compareAt} onChange={(event) => setCompareAt(event.target.value)} placeholder="0,00" />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="admin-form-g">
              <span>Desde</span>
              <input className="ui-input admin-mono" type="date" value={priceValidFrom} onChange={(event) => setPriceValidFrom(event.target.value)} />
            </label>
            <label className="admin-form-g">
              <span>Hasta</span>
              <input className="ui-input admin-mono" type="date" value={priceValidTo} onChange={(event) => setPriceValidTo(event.target.value)} />
            </label>
          </div>
          <Button variant="primary" loading={manualPrice.isPending} disabled={!canSaveManual} onClick={() => manualPrice.mutate()}>
            Guardar precio manual
          </Button>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel__h">
          <h3>Regla de markup</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <label className="admin-form-g">
            <span>Alcance</span>
            <Select value={scope} onChange={(event) => setScope(event.target.value as PricingScope)} options={SCOPE_OPTIONS} />
          </label>
          {needsScopeId && (
            <label className="admin-form-g">
              <span>{scope === PricingScope.CATEGORY ? "Categoria" : "Producto"} (scopeId)</span>
              <input className="ui-input admin-mono" value={scopeId} onChange={(event) => setScopeId(event.target.value)} placeholder="UUID requerido" />
            </label>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="admin-form-g">
              <span>Tipo</span>
              <Select value={kind} onChange={(event) => setKind(event.target.value as PricingValueKind)} options={KIND_OPTIONS} />
            </label>
            <label className="admin-form-g">
              <span>{kind === PricingValueKind.PERCENT ? "Valor (%)" : `Valor (${currency})`}</span>
              <input className="ui-input admin-mono" value={ruleValue} onChange={(event) => setRuleValue(event.target.value)} placeholder={kind === PricingValueKind.PERCENT ? "35" : "1500"} />
            </label>
          </div>
          <label className="admin-form-g">
            <span>Margen minimo (%)</span>
            <input className="ui-input admin-mono" value={minMargin} onChange={(event) => setMinMargin(event.target.value)} placeholder="Opcional" />
          </label>
          <Button variant="primary" loading={markupRule.isPending} disabled={!canSaveRule} onClick={() => markupRule.mutate()}>
            Guardar regla
          </Button>
        </div>
      </div>
    </div>
  );
}

function DiscountDialog({
  open,
  onClose,
  onSaved,
  product,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  product: ProductCard | null;
}) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [scope, setScope] = useState<PricingScope>(PricingScope.GLOBAL);
  const [scopeId, setScopeId] = useState("");
  const [kind, setKind] = useState<PricingValueKind>(PricingValueKind.PERCENT);
  const [value, setValue] = useState("");
  const [validFrom, setValidFrom] = useState(todayInput());
  const [validTo, setValidTo] = useState("");
  const [maxUses, setMaxUses] = useState("");

  useEffect(() => {
    if (!open) return;
    setScopeId(productScopeId(product, scope));
  }, [open, product, scope]);

  const create = useMutation({
    mutationFn: () =>
      trpc.pricing.discounts.create.mutate({
        code: code.trim() || null,
        scope,
        ...(scope === PricingScope.GLOBAL ? {} : { scopeId: scopeId.trim() }),
        kind,
        value: kind === PricingValueKind.PERCENT ? percentToBps(value) : moneyToMinor(value),
        validFrom: new Date(validFrom),
        ...(validTo ? { validTo: new Date(validTo) } : {}),
        maxUses: maxUses.trim() ? Number(maxUses) : null,
      }),
    onSuccess: () => {
      onSaved();
      toast({ tone: "success", title: "Descuento creado" });
      onClose();
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo crear el descuento", message: err instanceof Error ? err.message : undefined }),
  });

  const needsScopeId = scope !== PricingScope.GLOBAL;
  const canSubmit = value.trim().length > 0 && (!needsScopeId || scopeId.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Nuevo descuento"
        description="La vigencia y el alcance se validan antes de guardar."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button variant="primary" loading={create.isPending} disabled={!canSubmit} onClick={() => create.mutate()}>
              Crear descuento
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <label className="admin-form-g">
            <span>Codigo</span>
            <input className="ui-input admin-mono" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Opcional" />
          </label>
          <label className="admin-form-g">
            <span>Alcance</span>
            <Select value={scope} onChange={(event) => setScope(event.target.value as PricingScope)} options={SCOPE_OPTIONS} />
          </label>
          {needsScopeId && (
            <label className="admin-form-g">
              <span>{scope === PricingScope.CATEGORY ? "Categoria" : "Producto"} (scopeId)</span>
              <input className="ui-input admin-mono" value={scopeId} onChange={(event) => setScopeId(event.target.value)} placeholder="UUID requerido" />
            </label>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="admin-form-g">
              <span>Tipo</span>
              <Select value={kind} onChange={(event) => setKind(event.target.value as PricingValueKind)} options={KIND_OPTIONS} />
            </label>
            <label className="admin-form-g">
              <span>{kind === PricingValueKind.PERCENT ? "Valor (%)" : "Valor (ARS)"}</span>
              <input className="ui-input admin-mono" value={value} onChange={(event) => setValue(event.target.value)} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="admin-form-g">
              <span>Desde</span>
              <input className="ui-input admin-mono" type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
            </label>
            <label className="admin-form-g">
              <span>Hasta</span>
              <input className="ui-input admin-mono" type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} />
            </label>
          </div>
          <label className="admin-form-g">
            <span>Usos maximos</span>
            <input className="ui-input admin-mono" type="number" min={1} value={maxUses} onChange={(event) => setMaxUses(event.target.value)} placeholder="Sin limite" />
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}
