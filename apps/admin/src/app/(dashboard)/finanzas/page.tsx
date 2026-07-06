"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  BadgeDollarSign,
  Download,
  FileText,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  TriangleAlert,
  WalletCards,
} from "lucide-react";
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
import { DocumentType, type Currency, type DocumentSummary } from "@cloudcommerce/types";
import { RevenueAreaChart } from "@/components/charts/revenue-area-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { trpc } from "@/lib/trpc";
import { formatDate, formatMinor } from "@/lib/format";

const DOCUMENT_TYPES: { value: DocumentType | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: DocumentType.REMITO, label: "Remitos" },
  { value: DocumentType.FACTURA, label: "Facturas" },
  { value: DocumentType.NOTA_CREDITO, label: "Notas de credito" },
];
const FINANCE_RANGES = [
  { value: "this-month", label: "Mes" },
  { value: "last-30d", label: "30d" },
  { value: "ytd", label: "YTD" },
] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function moneyLabel(amountMinor: number, currency: Currency): string {
  if (currency === "ARS") return formatMinor(amountMinor);
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD" }).format(amountMinor / 100);
}

function documentTypeLabel(type: DocumentType): string {
  if (type === DocumentType.NOTA_CREDITO) return "Nota de credito";
  if (type === DocumentType.FACTURA) return "Factura";
  return "Remito";
}

function deltaLabel(value: number | null): ReactNode {
  if (value === null) return <span className="admin-cell-sub">sin comparacion</span>;
  const positive = value >= 0;
  return (
    <span style={{ color: positive ? "var(--admin-success)" : "var(--admin-danger)", display: "inline-flex", alignItems: "center", gap: 4 }}>
      {positive ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
      {Math.abs(value * 100).toFixed(1)}%
    </span>
  );
}

export default function FinancePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [range, setRange] = useState<(typeof FINANCE_RANGES)[number]["value"]>("this-month");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [type, setType] = useState<DocumentType | "all">("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState(currentPeriod());

  const documents = useQuery({
    queryKey: ["finance", "documents", type, orderSearch, customerSearch],
    queryFn: () =>
      trpc.finance.listDocuments.query({
        limit: 50,
        ...(type !== "all" ? { type } : {}),
        ...(UUID_RE.test(orderSearch.trim()) ? { orderId: orderSearch.trim() } : {}),
        ...(UUID_RE.test(customerSearch.trim()) ? { customerId: customerSearch.trim() } : {}),
      }),
    retry: false,
  });

  const kpis = useQuery({
    queryKey: ["finance", "kpis", range, currency],
    queryFn: () => trpc.finance.getKpis.query({ range, currency }),
    retry: false,
  });

  const report = useQuery({
    queryKey: ["finance", "periodReport", period, currency],
    queryFn: () => trpc.finance.getPeriodReport.query({ period, compareTo: "previous", currency }),
    retry: false,
  });

  const download = useMutation({
    mutationFn: (documentId: string) => trpc.finance.getDocumentDownloadUrl.mutate({ documentId }),
    onSuccess: (result) => {
      window.open(result.url, "_blank", "noopener,noreferrer");
      toast({ tone: "success", title: "Descarga iniciada", message: result.filename });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo descargar", message: err instanceof Error ? err.message : undefined }),
  });

  const recompute = useMutation({
    mutationFn: () => trpc.finance.recomputePeriodSnapshot.mutate({ period, currency }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "periodReport"] });
      qc.invalidateQueries({ queryKey: ["finance", "kpis"] });
      toast({ tone: "success", title: "Periodo recalculado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo recalcular", message: err instanceof Error ? err.message : undefined }),
  });

  const columns = useMemo<ColumnDef<DocumentSummary, unknown>[]>(
    () => [
      {
        id: "number",
        header: "Documento",
        cell: ({ row }) => (
          <span>
            <span className="admin-cell-str admin-mono">{row.original.displayNumber}</span>
            <span className="admin-cell-sub">{row.original.series}</span>
          </span>
        ),
      },
      {
        id: "type",
        header: "Tipo",
        cell: ({ row }) => <Badge tone="info">{documentTypeLabel(row.original.type)}</Badge>,
      },
      {
        id: "order",
        header: "Pedido",
        cell: ({ row }) => <span className="admin-mono">{row.original.orderId ?? "-"}</span>,
      },
      {
        id: "total",
        header: "Monto",
        cell: ({ row }) => (
          <span className="admin-mono" style={{ fontWeight: 650, color: "var(--admin-text-primary)" }}>
            {moneyLabel(row.original.total.amountMinor, row.original.total.currency)}
          </span>
        ),
      },
      {
        id: "issued",
        header: "Fecha",
        cell: ({ row }) => <span className="admin-cell-sub">{row.original.issuedAt ? formatDate(row.original.issuedAt) : formatDate(row.original.createdAt)}</span>,
      },
      {
        id: "status",
        header: "Estado",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            disabled={row.original.status !== "AVAILABLE"}
            loading={download.isPending}
            onClick={(event) => {
              event.stopPropagation();
              download.mutate(row.original.id);
            }}
          >
            <Download size={15} /> Descargar
          </Button>
        ),
      },
    ],
    [download],
  );

  const financeKpis = kpis.data
    ? [
        { label: "Ventas", value: kpis.data.totalRevenue.amountMinor / 100, format: (n: number) => moneyLabel(Math.round(n * 100), kpis.data.totalRevenue.currency), icon: BadgeDollarSign },
        { label: "Costo", value: kpis.data.totalCost.amountMinor / 100, format: (n: number) => moneyLabel(Math.round(n * 100), kpis.data.totalCost.currency), icon: WalletCards },
        { label: "Margen", value: kpis.data.totalMargin.amountMinor / 100, format: (n: number) => moneyLabel(Math.round(n * 100), kpis.data.totalMargin.currency), icon: ReceiptText },
        { label: "Ticket promedio", value: kpis.data.avgTicket.amountMinor / 100, format: (n: number) => moneyLabel(Math.round(n * 100), kpis.data.avgTicket.currency), icon: FileText },
      ]
    : [];
  const trendPoints = kpis.data?.trend.map((point) => ({ bucket: point.period, label: point.period, value: point.revenue.amountMinor })) ?? [];

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Finanzas</h1>
          <div className="admin-ph__sub">Documentos fiscales, margen y cierre de periodo</div>
        </div>
        <div className="admin-ph__actions">
          <div className="admin-segs">
            {(["ARS", "USD"] as Currency[]).map((item) => (
              <button key={item} data-on={currency === item || undefined} onClick={() => setCurrency(item)}>
                {item}
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={() => setGenerating(true)}>
            <Plus size={16} /> Generar documento
          </Button>
        </div>
      </div>

      {kpis.isError ? (
        <div className="admin-panel admin-empty">No disponible para tu rol</div>
      ) : (
        <div className="admin-grid admin-grid--kpi">
          {kpis.isLoading
            ? [0, 1, 2, 3].map((item) => (
                <div className="admin-kpi" key={item}>
                  <Skeleton height={12} width="50%" />
                  <div style={{ marginTop: 14 }}>
                    <Skeleton height={24} width="70%" />
                  </div>
                </div>
              ))
            : financeKpis.map((item, index) => (
                <KpiCard key={item.label} label={item.label} value={item.value} format={item.format} icon={item.icon} index={index} />
              ))}
        </div>
      )}

      <div className="admin-grid admin-grid--2" style={{ marginTop: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Tendencia de ingresos</h3>
            <div className="admin-segs">
              {FINANCE_RANGES.map((item) => (
                <button key={item.value} data-on={range === item.value || undefined} onClick={() => setRange(item.value)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {kpis.isLoading ? (
            <Skeleton height={210} radius={12} />
          ) : kpis.isError || !kpis.data ? (
            <div className="admin-empty" style={{ padding: "42px 0" }}>No disponible para tu rol</div>
          ) : (
            <RevenueAreaChart points={trendPoints} format={(value) => moneyLabel(value, currency)} height={210} />
          )}
        </div>

        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Reporte de periodo</h3>
            <Button variant="secondary" size="sm" loading={recompute.isPending} onClick={() => recompute.mutate()}>
              <RefreshCw size={15} /> Recalcular
            </Button>
          </div>
          <label className="admin-form-g">
            <span>Periodo</span>
            <input className="ui-input admin-mono" value={period} onChange={(event) => setPeriod(event.target.value)} placeholder="YYYY-MM" />
          </label>
          <div style={{ marginTop: 14 }}>
            {report.isLoading ? (
              <Skeleton height={150} radius={12} />
            ) : report.isError || !report.data ? (
              <div className="admin-empty" style={{ padding: "32px 0" }}>No disponible para tu rol</div>
            ) : (
              <PeriodReportPanel report={report.data} />
            )}
          </div>
        </div>
      </div>

      <div className="admin-tbl-card" style={{ marginTop: 16 }}>
        <div className="admin-toolbar">
          <div className="admin-field" style={{ minWidth: 230 }}>
            <Search size={15} />
            <input value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Pedido UUID" />
          </div>
          <div className="admin-field" style={{ minWidth: 230 }}>
            <Search size={15} />
            <input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Cliente UUID" />
          </div>
          {DOCUMENT_TYPES.map((item) => (
            <span key={item.value} className="admin-chip" data-on={type === item.value || undefined} onClick={() => setType(item.value)}>
              {item.label}
            </span>
          ))}
        </div>
        {documents.isError ? (
          <div className="admin-empty">No disponible para tu rol</div>
        ) : (
          <DataTable
            columns={columns}
            data={documents.data?.items ?? []}
            loading={documents.isLoading}
            onRowClick={(row) => router.push(`/finanzas/${row.id}`)}
            emptyState={
              <div>
                <FileText size={38} style={{ opacity: 0.5, marginBottom: 12 }} />
                <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin documentos</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>Genera un remito, factura o nota de credito desde una orden.</div>
              </div>
            }
          />
        )}
      </div>

      <GenerateDocumentDialog
        open={generating}
        onClose={() => setGenerating(false)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["finance"] });
        }}
      />
    </div>
  );
}

function PeriodReportPanel({
  report,
}: {
  report: Awaited<ReturnType<typeof trpc.finance.getPeriodReport.query>>;
}) {
  return (
    <div>
      {report.linesMissingCost > 0 && (
        <div className="admin-info-strip">
          <TriangleAlert size={17} />
          {report.linesMissingCost} linea(s) sin costo snapshot. El margen puede estar subestimado.
        </div>
      )}
      <div className="admin-detail-kv">
        <span>Ingresos</span>
        <b className="admin-mono">{moneyLabel(report.revenue.amountMinor, report.revenue.currency)}</b>
      </div>
      <div className="admin-detail-kv">
        <span>Costo</span>
        <b className="admin-mono">{moneyLabel(report.cost.amountMinor, report.cost.currency)}</b>
      </div>
      <div className="admin-detail-kv">
        <span>Margen</span>
        <b className="admin-mono">{moneyLabel(report.margin.amountMinor, report.margin.currency)}</b>
      </div>
      <div className="admin-detail-kv">
        <span>Ordenes</span>
        <b className="admin-mono">{report.ordersCount.toLocaleString("es-AR")}</b>
      </div>
      {report.comparison && (
        <>
          <div className="sc-lbl" style={{ marginTop: 14 }}>Comparacion vs. {report.comparison.period}</div>
          <div className="admin-detail-kv">
            <span>Ingresos</span>
            <b className="admin-mono">{deltaLabel(report.comparison.revenueDeltaPct)}</b>
          </div>
          <div className="admin-detail-kv">
            <span>Margen</span>
            <b className="admin-mono">{deltaLabel(report.comparison.marginDeltaPct)}</b>
          </div>
          <div className="admin-detail-kv">
            <span>Ordenes</span>
            <b className="admin-mono">{deltaLabel(report.comparison.ordersDeltaPct)}</b>
          </div>
        </>
      )}
    </div>
  );
}

function GenerateDocumentDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState<DocumentType>(DocumentType.FACTURA);
  const [orderId, setOrderId] = useState("");
  const [series, setSeries] = useState("A");
  const [relatedDocumentId, setRelatedDocumentId] = useState("");

  const orders = useQuery({
    queryKey: ["finance", "ordersForDocument"],
    queryFn: () => trpc.orders.list.query({ limit: 30, sort: "newest" }),
    enabled: open,
  });

  const invoices = useQuery({
    queryKey: ["finance", "relatedInvoices"],
    queryFn: () => trpc.finance.listDocuments.query({ limit: 50, type: DocumentType.FACTURA }),
    enabled: open && type === DocumentType.NOTA_CREDITO,
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () =>
      trpc.finance.generateDocument.mutate({
        type,
        orderId,
        series: series.trim() || undefined,
        ...(type === DocumentType.NOTA_CREDITO ? { relatedDocumentId } : {}),
      }),
    onSuccess: () => {
      onSaved();
      toast({ tone: "success", title: "Documento generado" });
      onClose();
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo generar", message: err instanceof Error ? err.message : undefined }),
  });

  const needsRelated = type === DocumentType.NOTA_CREDITO;
  const canSubmit = UUID_RE.test(orderId) && (!needsRelated || UUID_RE.test(relatedDocumentId));

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Generar documento"
        description="El numero fiscal lo asigna el backend al confirmar."
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button variant="primary" loading={generate.isPending} disabled={!canSubmit} onClick={() => generate.mutate()}>
              Generar
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <label className="admin-form-g">
            <span>Tipo</span>
            <Select
              value={type}
              onChange={(event) => {
                setType(event.target.value as DocumentType);
                setRelatedDocumentId("");
              }}
              options={[
                { value: DocumentType.REMITO, label: "Remito" },
                { value: DocumentType.FACTURA, label: "Factura" },
                { value: DocumentType.NOTA_CREDITO, label: "Nota de credito" },
              ]}
            />
          </label>
          <label className="admin-form-g">
            <span>Pedido</span>
            <Select
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              options={[
                { value: "", label: orders.isLoading ? "Cargando pedidos..." : "Seleccionar pedido" },
                ...(orders.data?.items.map((order) => ({
                  value: order.id,
                  label: `${order.orderNumber} - ${moneyLabel(order.total.amountMinor, order.total.currency)}`,
                })) ?? []),
              ]}
            />
          </label>
          <label className="admin-form-g">
            <span>Serie</span>
            <input className="ui-input admin-mono" value={series} onChange={(event) => setSeries(event.target.value.toUpperCase())} maxLength={8} />
          </label>
          {needsRelated && (
            <label className="admin-form-g">
              <span>Factura a corregir</span>
              <Select
                value={relatedDocumentId}
                onChange={(event) => setRelatedDocumentId(event.target.value)}
                options={[
                  { value: "", label: invoices.isLoading ? "Cargando facturas..." : "Seleccionar factura" },
                  ...(invoices.data?.items.map((invoice) => ({
                    value: invoice.id,
                    label: `${invoice.displayNumber} - ${moneyLabel(invoice.total.amountMinor, invoice.total.currency)}`,
                  })) ?? []),
                ]}
              />
            </label>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
