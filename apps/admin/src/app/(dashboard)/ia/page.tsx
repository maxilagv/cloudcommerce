"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BarChart3, FileText, MessageCircle, Sparkles, Tag, Trash2, Wand2 } from "lucide-react";
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
  AiAlertKind,
  AiAlertStatus,
  AiGenerationKind,
  AiGenerationStatus,
  type AiAlertRecord,
  type AiGenerationSummary,
  type CategorySlice,
} from "@cloudcommerce/types";
import { CategoryBarChart } from "@/components/charts/category-bar-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { trpc } from "@/lib/trpc";
import { formatDate, formatMinor } from "@/lib/format";

type Range = "7d" | "30d" | "12m";
type UsageMetric = "count" | "cost";

const RANGES: { value: Range; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "12m", label: "12m" },
];
const GENERATION_KINDS: (AiGenerationKind | "all")[] = ["all", ...Object.values(AiGenerationKind)];
const GENERATION_STATUSES: (AiGenerationStatus | "all")[] = ["all", ...Object.values(AiGenerationStatus)];

function rangeDates(range: Range): { dateFrom: string; dateTo: string } {
  const to = new Date();
  const from = new Date(to);
  if (range === "7d") from.setDate(from.getDate() - 7);
  if (range === "30d") from.setDate(from.getDate() - 30);
  if (range === "12m") from.setMonth(from.getMonth() - 12);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

function kindLabel(kind: AiGenerationKind | string): string {
  const labels: Record<string, string> = {
    DESCRIPTION: "Descripcion",
    SPECS: "Specs",
    SEO: "SEO",
    IMAGE: "Imagen",
    RECOMMENDATION: "Recomendacion",
    TRENDS: "Tendencias",
    PRICING: "Pricing",
  };
  return labels[kind] ?? kind;
}

function alertKindLabel(kind: AiAlertKind): string {
  if (kind === AiAlertKind.PRICE) return "Precio";
  if (kind === AiAlertKind.STOCK) return "Stock";
  return "Tendencia";
}

function payloadSummary(payload: Record<string, unknown>): string {
  const signal = typeof payload.signal === "string" ? payload.signal : null;
  const targetType = typeof payload.targetType === "string" ? payload.targetType : null;
  const score = typeof payload.score === "number" ? `score ${payload.score.toFixed(2)}` : null;
  return [signal, targetType, score].filter(Boolean).join(" - ") || "Ver payload en backend";
}

export default function AiOverviewPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [range, setRange] = useState<Range>("30d");
  const [metric, setMetric] = useState<UsageMetric>("cost");
  const [kind, setKind] = useState<AiGenerationKind | "all">("all");
  const [status, setStatus] = useState<AiGenerationStatus | "all">("all");
  const [dismissTarget, setDismissTarget] = useState<AiAlertRecord | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [generationId, setGenerationId] = useState("");
  const dates = rangeDates(range);

  const usage = useQuery({
    queryKey: ["ai", "usage", range],
    queryFn: () => trpc.ai.getUsageSummary.query(dates),
    retry: false,
  });
  const alerts = useQuery({
    queryKey: ["ai", "alerts"],
    queryFn: () => trpc.ai.listAlerts.query({ limit: 50 }),
    retry: false,
  });
  const generations = useQuery({
    queryKey: ["ai", "generations", kind, status],
    queryFn: () =>
      trpc.ai.listGenerations.query({
        limit: 50,
        ...(kind !== "all" ? { kind } : {}),
        ...(status !== "all" ? { status } : {}),
      }),
    retry: false,
  });
  const generation = useQuery({
    queryKey: ["ai", "generation", generationId],
    queryFn: () => trpc.ai.getGeneration.query({ generationId }),
    enabled: generationId.length > 0,
    retry: false,
  });

  const invalidateAlerts = () => qc.invalidateQueries({ queryKey: ["ai", "alerts"] });

  const acknowledge = useMutation({
    mutationFn: (alertId: string) => trpc.ai.acknowledgeAlert.mutate({ alertId }),
    onSuccess: () => {
      invalidateAlerts();
      toast({ tone: "success", title: "Alerta reconocida" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo reconocer", message: err instanceof Error ? err.message : undefined }),
  });
  const resolve = useMutation({
    mutationFn: (alertId: string) => trpc.ai.resolveAlert.mutate({ alertId }),
    onSuccess: () => {
      invalidateAlerts();
      toast({ tone: "success", title: "Alerta resuelta" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo resolver", message: err instanceof Error ? err.message : undefined }),
  });
  const dismiss = useMutation({
    mutationFn: () => trpc.ai.dismissAlert.mutate({ alertId: dismissTarget!.id, reason: dismissReason.trim() }),
    onSuccess: () => {
      invalidateAlerts();
      toast({ tone: "success", title: "Alerta descartada" });
      setDismissTarget(null);
      setDismissReason("");
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo descartar", message: err instanceof Error ? err.message : undefined }),
  });

  const usageSlices: CategorySlice[] =
    usage.data?.byKind.map((item) => ({
      categoryId: item.kind,
      name: kindLabel(item.kind),
      value: metric === "cost" ? item.costMinor : item.count,
      share: 0,
    })) ?? [];

  const generationColumns = useMemo<ColumnDef<AiGenerationSummary, unknown>[]>(
    () => [
      {
        id: "kind",
        header: "Tipo",
        cell: ({ row }) => (
          <span>
            <span className="admin-cell-str">{kindLabel(row.original.kind)}</span>
            <span className="admin-cell-sub admin-mono">{row.original.targetId ?? row.original.targetType}</span>
          </span>
        ),
      },
      { id: "status", header: "Estado", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
      {
        id: "cost",
        header: "Costo",
        cell: ({ row }) => <span className="admin-mono">{row.original.costEstimateMinor === null ? "-" : formatMinor(row.original.costEstimateMinor)}</span>,
      },
      { id: "created", header: "Creada", cell: ({ row }) => <span className="admin-cell-sub">{formatDate(row.original.createdAt)}</span> },
    ],
    [],
  );

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Herramientas IA</h1>
          <div className="admin-ph__sub">Uso, costo, alertas y auditoria de generaciones</div>
        </div>
        <div className="admin-ph__actions">
          <Link href="/ia/descripciones"><Button variant="secondary"><Wand2 size={16} /> Textos y SEO</Button></Link>
          <Link href="/ia/clientes"><Button variant="secondary"><MessageCircle size={16} /> Vendedor IA</Button></Link>
          <Link href="/ia/pricing"><Button variant="primary"><Tag size={16} /> Pricing IA</Button></Link>
        </div>
      </div>

      <div className="admin-ph__actions" style={{ marginBottom: 16 }}>
        <div className="admin-segs">
          {RANGES.map((item) => (
            <button key={item.value} data-on={range === item.value || undefined} onClick={() => setRange(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {usage.isError ? (
        <div className="admin-panel admin-empty">No disponible para tu rol</div>
      ) : (
        <>
          <div className="admin-grid admin-grid--kpi">
            {usage.isLoading || !usage.data ? (
              [0, 1].map((item) => (
                <div className="admin-kpi" key={item}>
                  <Skeleton height={12} width="55%" />
                  <div style={{ marginTop: 14 }}><Skeleton height={24} width="65%" /></div>
                </div>
              ))
            ) : (
              <>
                <KpiCard label="Costo IA" value={usage.data.totalCostMinor} format={(n) => formatMinor(Math.round(n))} icon={Sparkles} index={0} />
                <KpiCard label="Generaciones" value={usage.data.count} format={(n) => Math.round(n).toLocaleString("es-AR")} icon={BarChart3} index={1} />
              </>
            )}
          </div>

          <div className="admin-panel" style={{ marginTop: 16 }}>
            <div className="admin-panel__h">
              <h3>Uso por tipo</h3>
              <div className="admin-segs">
                <button data-on={metric === "cost" || undefined} onClick={() => setMetric("cost")}>Costo</button>
                <button data-on={metric === "count" || undefined} onClick={() => setMetric("count")}>Cantidad</button>
              </div>
            </div>
            {usage.isLoading ? (
              <Skeleton height={190} radius={12} />
            ) : (
              <CategoryBarChart slices={usageSlices} format={metric === "cost" ? formatMinor : (n) => Math.round(n).toLocaleString("es-AR")} />
            )}
          </div>
        </>
      )}

      <div className="admin-grid admin-grid--2" style={{ marginTop: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel__h"><h3>Alertas IA</h3></div>
          {alerts.isLoading ? (
            <Skeleton height={210} radius={12} />
          ) : alerts.isError ? (
            <div className="admin-empty" style={{ padding: "32px 0" }}>No disponible para tu rol</div>
          ) : (alerts.data?.items ?? []).length === 0 ? (
            <div className="admin-empty" style={{ padding: "32px 0" }}>Sin alertas abiertas.</div>
          ) : (
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Alerta</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(alerts.data?.items ?? []).map((alert) => (
                  <tr key={alert.id}>
                    <td>
                      <span className="admin-cell-str">{alertKindLabel(alert.kind)}</span>
                      <span className="admin-cell-sub">{payloadSummary(alert.payload)}</span>
                    </td>
                    <td><StatusBadge status={alert.status} /></td>
                    <td style={{ textAlign: "right" }}>
                      {alert.status === AiAlertStatus.OPEN && (
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <Button variant="secondary" size="sm" loading={acknowledge.isPending} onClick={() => acknowledge.mutate(alert.id)}>Reconocer</Button>
                          <Button variant="secondary" size="sm" loading={resolve.isPending} onClick={() => resolve.mutate(alert.id)}>Resolver</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDismissTarget(alert)}><Trash2 size={15} /> Descartar</Button>
                        </div>
                      )}
                      {alert.status === AiAlertStatus.ACKNOWLEDGED && (
                        <div style={{ display: "inline-flex", gap: 8 }}>
                          <Button variant="secondary" size="sm" loading={resolve.isPending} onClick={() => resolve.mutate(alert.id)}>Resolver</Button>
                          <Button variant="ghost" size="sm" onClick={() => setDismissTarget(alert)}>Descartar</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="admin-panel">
          <div className="admin-panel__h"><h3>Estados de generaciones</h3></div>
          {usage.isLoading ? (
            <Skeleton height={210} radius={12} />
          ) : usage.isError || !usage.data ? (
            <div className="admin-empty" style={{ padding: "32px 0" }}>No disponible para tu rol</div>
          ) : (
            usage.data.byStatus.map((item) => (
              <div className="admin-detail-kv" key={item.status}>
                <span><StatusBadge status={item.status} /></span>
                <b className="admin-mono">{item.count}</b>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="admin-tbl-card" style={{ marginTop: 16 }}>
        <div className="admin-toolbar">
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as AiGenerationKind | "all")}
            options={GENERATION_KINDS.map((item) => ({ value: item, label: item === "all" ? "Todos los tipos" : kindLabel(item) }))}
          />
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as AiGenerationStatus | "all")}
            options={GENERATION_STATUSES.map((item) => ({ value: item, label: item === "all" ? "Todos los estados" : item }))}
          />
        </div>
        {generations.isError ? (
          <div className="admin-empty">No disponible para tu rol</div>
        ) : (
          <DataTable
            columns={generationColumns}
            data={generations.data?.items ?? []}
            loading={generations.isLoading}
            onRowClick={(row) => setGenerationId(row.id)}
            emptyState={
              <div>
                <FileText size={38} style={{ opacity: 0.5, marginBottom: 12 }} />
                <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin generaciones</div>
              </div>
            }
          />
        )}
      </div>

      <Dialog open={dismissTarget !== null} onOpenChange={(open) => !open && setDismissTarget(null)}>
        <DialogContent
          tone="danger"
          title="Descartar alerta"
          description="El motivo es obligatorio y queda auditado."
          footer={
            <>
              <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
              <Button variant="danger" loading={dismiss.isPending} disabled={dismissReason.trim().length === 0} onClick={() => dismiss.mutate()}>
                Descartar
              </Button>
            </>
          }
        >
          <label className="admin-form-g">
            <span>Motivo</span>
            <textarea className="ui-input" rows={3} value={dismissReason} onChange={(event) => setDismissReason(event.target.value)} />
          </label>
        </DialogContent>
      </Dialog>

      <Dialog open={generationId.length > 0} onOpenChange={(open) => !open && setGenerationId("")}>
        <DialogContent
          title="Detalle de generacion"
          description={generationId}
          footer={
            <DialogClose asChild>
              <Button variant="ghost">Cerrar</Button>
            </DialogClose>
          }
        >
          {generation.isLoading ? (
            <Skeleton height={120} radius={12} />
          ) : generation.isError || !generation.data ? (
            <div className="admin-empty" style={{ padding: "24px 0" }}>No se pudo cargar el detalle.</div>
          ) : (
            <div>
              <div className="admin-detail-kv"><span>Tipo</span><b>{kindLabel(generation.data.kind)}</b></div>
              <div className="admin-detail-kv"><span>Estado</span><StatusBadge status={generation.data.status} /></div>
              <div className="admin-detail-kv"><span>Target</span><b className="admin-mono">{generation.data.targetId ?? generation.data.targetType}</b></div>
              <div className="admin-detail-kv"><span>Costo</span><b className="admin-mono">{generation.data.costEstimateMinor === null ? "-" : formatMinor(generation.data.costEstimateMinor)}</b></div>
              <div className="admin-detail-kv"><span>Creada</span><b>{formatDate(generation.data.createdAt)}</b></div>
              <div className="admin-detail-kv"><span>Completada</span><b>{generation.data.completedAt ? formatDate(generation.data.completedAt) : "-"}</b></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
