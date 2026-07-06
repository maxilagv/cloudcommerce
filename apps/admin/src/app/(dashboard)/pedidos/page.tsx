"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Search, ShoppingCart, UserPlus } from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  Dialog,
  DialogClose,
  DialogContent,
  Select,
  StatusBadge,
  useToast,
  type ColumnDef,
} from "@cloudcommerce/ui";
import {
  OrderChannel,
  OrderStatus,
  ShippingMethod,
  type CustomerAddressResponse,
  type CustomerSummary,
  type OrderSummary,
  type ProductCard,
  type ProductVariantResponse,
} from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatDate, formatMinor } from "@/lib/format";

type StatusFilter = OrderStatus | "all";
type ChannelFilter = OrderChannel | "all";
type WizardStep = "customer" | "lines" | "shipping" | "confirm";
type DraftLine = {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  quantity: number;
};

const ORDER_STATUSES: StatusFilter[] = [
  "all",
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY_TO_SHIP,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

function statusFilterLabel(status: StatusFilter): string {
  if (status === "all") return "Todos";
  const labels: Record<OrderStatus, string> = {
    [OrderStatus.DRAFT]: "Borrador",
    [OrderStatus.PENDING_CONFIRMATION]: "Pendientes",
    [OrderStatus.CONFIRMED]: "Confirmados",
    [OrderStatus.PREPARING]: "Preparando",
    [OrderStatus.READY_TO_SHIP]: "Listos",
    [OrderStatus.SHIPPED]: "Enviados",
    [OrderStatus.DELIVERED]: "Entregados",
    [OrderStatus.CANCELLED]: "Cancelados",
    [OrderStatus.RETURN_REQUESTED]: "Devolucion",
    [OrderStatus.RETURNED]: "Devueltos",
  };
  return labels[status];
}

function channelLabel(channel: OrderChannel): string {
  return channel === OrderChannel.STORE ? "Tienda" : "Alta manual";
}

function shippingLabel(method: ShippingMethod): string {
  if (method === ShippingMethod.EXPRESS) return "Express";
  if (method === ShippingMethod.PICKUP) return "Retiro";
  return "Estandar";
}

export default function OrdersPage() {
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [creating, setCreating] = useState(false);

  const query = useQuery({
    queryKey: ["orders", "list", status, channel, dateFrom, dateTo],
    queryFn: () =>
      trpc.orders.list.query({
        limit: 50,
        sort: "newest",
        ...(status !== "all" ? { status } : {}),
        ...(channel !== "all" ? { channel } : {}),
        ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
        ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
      }),
    retry: false,
  });

  const columns = useMemo<ColumnDef<OrderSummary, unknown>[]>(
    () => [
      {
        id: "order",
        header: "Pedido",
        cell: ({ row }) => (
          <span>
            <span className="admin-cell-str admin-mono">{row.original.orderNumber}</span>
            <span className="admin-cell-sub">{row.original.itemCount} item(s)</span>
          </span>
        ),
      },
      {
        id: "customer",
        header: "Cliente",
        cell: ({ row }) => <span className="admin-mono">{row.original.customerId}</span>,
      },
      {
        id: "total",
        header: "Total",
        cell: ({ row }) => (
          <span className="admin-mono" style={{ fontWeight: 650, color: "var(--admin-text-primary)" }}>
            {formatMinor(row.original.total.amountMinor)}
          </span>
        ),
      },
      { id: "status", header: "Estado", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      { id: "channel", header: "Canal", cell: ({ row }) => <Badge tone="info">{channelLabel(row.original.channel)}</Badge> },
      { id: "created", header: "Fecha", cell: ({ row }) => <span className="admin-cell-sub">{formatDate(row.original.createdAt)}</span> },
    ],
    [],
  );

  const orders = query.data?.items ?? [];
  const filtered = orders.filter((order) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [order.orderNumber, order.customerId].some((value) => value.toLowerCase().includes(term));
  });

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Pedidos</h1>
          <div className="admin-ph__sub">
            {filtered.length} pedido(s){query.data?.nextCursor ? "+" : ""} en el ciclo de venta
          </div>
        </div>
        <div className="admin-ph__actions">
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nuevo pedido
          </Button>
        </div>
      </div>

      {query.isError ? (
        <div className="admin-panel admin-empty">
          <ShoppingCart size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
          <h4>No se pudieron cargar los pedidos</h4>
          <Button variant="secondary" onClick={() => query.refetch()} style={{ marginTop: 12 }}>
            Reintentar
          </Button>
        </div>
      ) : (
        <div className="admin-tbl-card">
          <div className="admin-toolbar">
            <div className="admin-field" style={{ minWidth: 230 }}>
              <Search size={15} />
              <input placeholder="Numero o cliente" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <input className="ui-input admin-mono" style={{ width: 150 }} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            <input className="ui-input admin-mono" style={{ width: 150 }} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            <span className="admin-chip" data-on={channel === "all" || undefined} onClick={() => setChannel("all")}>Canal: todos</span>
            <span className="admin-chip" data-on={channel === OrderChannel.STORE || undefined} onClick={() => setChannel(OrderChannel.STORE)}>Tienda</span>
            <span className="admin-chip" data-on={channel === OrderChannel.ADMIN_MANUAL || undefined} onClick={() => setChannel(OrderChannel.ADMIN_MANUAL)}>Manual</span>
            {ORDER_STATUSES.map((item) => (
              <span key={item} className="admin-chip" data-on={status === item || undefined} onClick={() => setStatus(item)}>
                {statusFilterLabel(item)}
              </span>
            ))}
          </div>
          <DataTable
            columns={columns}
            data={filtered}
            loading={query.isLoading}
            onRowClick={(row) => router.push(`/pedidos/${row.id}`)}
            emptyState={
              <div>
                <ShoppingCart size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
                <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin pedidos</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>
                  {search || status !== "all" || channel !== "all" ? "Proba limpiar los filtros" : "Crea un pedido manual"}
                </div>
              </div>
            }
          />
        </div>
      )}

      <ManualOrderWizard open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function ManualOrderWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>("customer");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(ShippingMethod.STANDARD);
  const [shippingAddressId, setShippingAddressId] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [notes, setNotes] = useState("");
  const [initialStatus, setInitialStatus] = useState<OrderStatus.PENDING_CONFIRMATION | OrderStatus.CONFIRMED>(OrderStatus.PENDING_CONFIRMATION);

  useEffect(() => {
    if (open) setStep("customer");
  }, [open]);

  const customers = useQuery({
    queryKey: ["customers", "search", customerQuery],
    queryFn: () =>
      trpc.customers.search.query({
        limit: 20,
        sort: "recent",
        ...(customerQuery.trim() ? { q: customerQuery.trim() } : {}),
      }),
    enabled: open,
  });

  const addresses = useQuery({
    queryKey: ["customers", "addresses", customerId],
    queryFn: () => trpc.customers.listAddresses.query({ customerId }),
    enabled: open && customerId.length > 0,
    retry: false,
  });

  const products = useQuery({
    queryKey: ["orders", "productSearch", productQuery],
    queryFn: () =>
      trpc.catalog.products.search.query({
        limit: 20,
        sort: "title_asc",
        ...(productQuery.trim() ? { query: productQuery.trim() } : {}),
      }),
    enabled: open && step === "lines",
  });

  const product = useQuery({
    queryKey: ["orders", "productDetail", selectedProductId],
    queryFn: () => trpc.catalog.products.byId.query({ productId: selectedProductId }),
    enabled: open && selectedProductId.length > 0,
    retry: false,
  });

  useEffect(() => {
    setSelectedVariantId("");
  }, [selectedProductId]);

  const createCustomer = useMutation({
    mutationFn: () =>
      trpc.customers.create.mutate({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(whatsapp.trim() ? { whatsapp: whatsapp.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        reason: "Alta manual de pedido",
      }),
    onSuccess: (customer) => {
      setCustomerId(customer.id);
      setCreatingCustomer(false);
      qc.invalidateQueries({ queryKey: ["customers", "search"] });
      toast({ tone: "success", title: "Cliente creado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo crear el cliente", message: err instanceof Error ? err.message : undefined }),
  });

  const createOrder = useMutation({
    mutationFn: () =>
      trpc.orders.createManual.mutate({
        customerId,
        shippingMethod,
        ...(shippingMethod !== ShippingMethod.PICKUP ? { shippingAddressId } : {}),
        lines: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
        ...(discountCode.trim() ? { discountCode: discountCode.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        initialStatus,
      }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["orders", "list"] });
      toast({ tone: "success", title: "Pedido creado", message: order.orderNumber });
      onClose();
      router.push(`/pedidos/${order.id}`);
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo crear el pedido", message: err instanceof Error ? err.message : undefined }),
  });

  const selectedCustomer = customers.data?.items.find((customer) => customer.id === customerId) ?? null;
  const productItems = products.data?.items ?? [];
  const selectedProduct = product.data ?? productItems.find((item) => item.id === selectedProductId) ?? null;
  const selectedVariant = product.data?.variants.find((variant) => variant.id === selectedVariantId) ?? null;
  const addressItems = addresses.data ?? [];
  const needsAddress = shippingMethod !== ShippingMethod.PICKUP;
  const canConfirm = customerId.length > 0 && lines.length > 0 && (!needsAddress || shippingAddressId.length > 0);

  function addLine() {
    if (!selectedProduct || !selectedVariant) return;
    const qty = Math.max(1, Math.min(20, Number(quantity) || 1));
    setLines((current) => {
      const existing = current.find((line) => line.variantId === selectedVariant.id);
      if (existing) {
        return current.map((line) => (line.variantId === selectedVariant.id ? { ...line, quantity: Math.min(20, line.quantity + qty) } : line));
      }
      return [
        ...current,
        {
          variantId: selectedVariant.id,
          productTitle: selectedProduct.title,
          variantTitle: selectedVariant.title,
          sku: selectedVariant.sku,
          quantity: qty,
        },
      ];
    });
    setQuantity("1");
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Nuevo pedido manual"
        description="Cliente, productos, envio y confirmacion."
        className="ui-dialog--wide"
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            {step !== "customer" && (
              <Button variant="secondary" onClick={() => setStep(step === "lines" ? "customer" : step === "shipping" ? "lines" : "shipping")}>
                Atras
              </Button>
            )}
            {step !== "confirm" ? (
              <Button
                variant="primary"
                disabled={(step === "customer" && !customerId) || (step === "lines" && lines.length === 0)}
                onClick={() => setStep(step === "customer" ? "lines" : step === "lines" ? "shipping" : "confirm")}
              >
                Continuar
              </Button>
            ) : (
              <Button variant="primary" loading={createOrder.isPending} disabled={!canConfirm} onClick={() => createOrder.mutate()}>
                Crear pedido
              </Button>
            )}
          </>
        }
      >
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            ["customer", "Cliente"],
            ["lines", "Lineas"],
            ["shipping", "Envio"],
            ["confirm", "Confirmar"],
          ].map(([value, label]) => (
            <span key={value} className="admin-chip" data-on={step === value || undefined}>
              {label}
            </span>
          ))}
        </div>

        {step === "customer" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <label className="admin-form-g">
              <span>Buscar cliente</span>
              <input className="ui-input" value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Nombre, WhatsApp o email" />
            </label>
            <Select
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              options={[
                { value: "", label: customers.isLoading ? "Cargando clientes..." : "Seleccionar cliente" },
                ...(customers.data?.items.map((customer) => ({ value: customer.id, label: customerLabel(customer) })) ?? []),
              ]}
            />
            <Button variant="secondary" onClick={() => setCreatingCustomer((value) => !value)}>
              <UserPlus size={16} /> Crear cliente rapido
            </Button>
            {creatingCustomer && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <input className="ui-input" placeholder="Nombre" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                <input className="ui-input" placeholder="Apellido" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                <input className="ui-input" placeholder="WhatsApp" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} />
                <input className="ui-input" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
                <Button variant="primary" loading={createCustomer.isPending} disabled={!firstName.trim() || !lastName.trim()} onClick={() => createCustomer.mutate()}>
                  Crear y usar
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "lines" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <label className="admin-form-g">
              <span>Buscar producto</span>
              <input className="ui-input" value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder="Nombre, SKU o slug" />
            </label>
            <Select
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
              options={[
                { value: "", label: products.isLoading ? "Cargando productos..." : "Seleccionar producto" },
                ...productItems.map((item) => ({ value: item.id, label: productLabel(item) })),
              ]}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px auto", gap: 10, alignItems: "end" }}>
              <label className="admin-form-g">
                <span>Variante</span>
                <Select
                  value={selectedVariantId}
                  disabled={!product.data}
                  onChange={(event) => setSelectedVariantId(event.target.value)}
                  options={[
                    { value: "", label: product.isLoading ? "Cargando variantes..." : "Seleccionar variante" },
                    ...(product.data?.variants.map((variant) => ({ value: variant.id, label: variantLabel(variant) })) ?? []),
                  ]}
                />
              </label>
              <label className="admin-form-g">
                <span>Cant.</span>
                <input className="ui-input admin-mono" type="number" min={1} max={20} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </label>
              <Button variant="secondary" disabled={!selectedVariant} onClick={addLine}>
                Agregar
              </Button>
            </div>
            <DraftLines lines={lines} onRemove={(variantId) => setLines((current) => current.filter((line) => line.variantId !== variantId))} />
          </div>
        )}

        {step === "shipping" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {selectedCustomer && <div className="admin-cell-sub">Cliente: {customerLabel(selectedCustomer)}</div>}
            <label className="admin-form-g">
              <span>Metodo</span>
              <Select
                value={shippingMethod}
                onChange={(event) => setShippingMethod(event.target.value as ShippingMethod)}
                options={[
                  { value: ShippingMethod.STANDARD, label: "Estandar" },
                  { value: ShippingMethod.EXPRESS, label: "Express" },
                  { value: ShippingMethod.PICKUP, label: "Retiro" },
                ]}
              />
            </label>
            {needsAddress && (
              <label className="admin-form-g">
                <span>Domicilio</span>
                <Select
                  value={shippingAddressId}
                  onChange={(event) => setShippingAddressId(event.target.value)}
                  options={[
                    { value: "", label: addresses.isLoading ? "Cargando domicilios..." : "Seleccionar domicilio" },
                    ...addressItems.map((address) => ({ value: address.id, label: addressLabel(address) })),
                  ]}
                />
              </label>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="admin-form-g">
                <span>Descuento</span>
                <input className="ui-input admin-mono" value={discountCode} onChange={(event) => setDiscountCode(event.target.value.toUpperCase())} placeholder="Opcional" />
              </label>
              <label className="admin-form-g">
                <span>Estado inicial</span>
                <Select
                  value={initialStatus}
                  onChange={(event) => setInitialStatus(event.target.value as OrderStatus.PENDING_CONFIRMATION | OrderStatus.CONFIRMED)}
                  options={[
                    { value: OrderStatus.PENDING_CONFIRMATION, label: "Pendiente" },
                    { value: OrderStatus.CONFIRMED, label: "Confirmado" },
                  ]}
                />
              </label>
            </div>
            <label className="admin-form-g">
              <span>Notas</span>
              <textarea className="ui-input" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" />
            </label>
          </div>
        )}

        {step === "confirm" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="admin-detail-kv"><span>Cliente</span><b>{selectedCustomer ? customerLabel(selectedCustomer) : customerId}</b></div>
            <div className="admin-detail-kv"><span>Lineas</span><b className="admin-mono">{lines.length}</b></div>
            <div className="admin-detail-kv"><span>Metodo</span><b>{shippingLabel(shippingMethod)}</b></div>
            <div className="admin-detail-kv"><span>Estado inicial</span><StatusBadge status={initialStatus} /></div>
            <DraftLines lines={lines} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function customerLabel(customer: CustomerSummary): string {
  return `${customer.displayName}${customer.whatsapp ? ` - ${customer.whatsapp}` : ""}`;
}

function productLabel(product: ProductCard): string {
  return `${product.title}${product.sku ? ` - ${product.sku}` : ""}`;
}

function variantLabel(variant: ProductVariantResponse): string {
  return `${variant.title} - ${variant.sku}`;
}

function addressLabel(address: CustomerAddressResponse): string {
  return `${address.label ?? "Domicilio"} - ${address.street} ${address.streetNumber ?? ""}, ${address.city}`;
}

function DraftLines({ lines, onRemove }: { lines: DraftLine[]; onRemove?: (variantId: string) => void }) {
  if (lines.length === 0) {
    return (
      <div className="admin-empty" style={{ padding: "24px 0" }}>
        <Package size={32} style={{ opacity: 0.5, marginBottom: 8 }} />
        Sin lineas agregadas
      </div>
    );
  }
  return (
    <table className="ui-table">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Cant.</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr key={line.variantId}>
            <td>
              <span className="admin-cell-str">{line.productTitle}</span>
              <span className="admin-cell-sub admin-mono">{line.variantTitle} - {line.sku}</span>
            </td>
            <td className="admin-mono">{line.quantity}</td>
            <td style={{ textAlign: "right" }}>
              {onRemove && (
                <Button variant="ghost" size="sm" onClick={() => onRemove(line.variantId)}>
                  Quitar
                </Button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
