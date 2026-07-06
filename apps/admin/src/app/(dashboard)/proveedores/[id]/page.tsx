"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Eye, EyeOff, Link2, Play, RefreshCw, Search, ShieldCheck, Truck } from "lucide-react";
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
  Switch,
  useToast,
  type BadgeTone,
  type ColumnDef,
} from "@cloudcommerce/ui";
import {
  SupplierFeedKind,
  SupplierForwardStatus,
  SupplierSyncStatus,
  type FeedRunResult,
  type SupplierContact,
  type SupplierFeedRecord,
  type SupplierFeedRunSummary,
  type SupplierOrderRefRecord,
  type SupplierProductMapRecord,
  type SupplierSummary,
} from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/format";

type Tab = "general" | "feed" | "map" | "orders";
type AuthKind = "api_key" | "bearer" | "hmac";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROVIDER_ERROR = "No se pudo conectar con el proveedor, verifica la URL configurada";
const DEFAULT_FIELD_MAP = {
  externalId: "external_id",
  title: "title",
  costAmountMinor: "cost_amount_minor",
  stock: "stock",
  discontinued: "discontinued",
};
const FIELD_MAP_FIELDS: (keyof typeof DEFAULT_FIELD_MAP)[] = [
  "externalId",
  "title",
  "costAmountMinor",
  "stock",
  "discontinued",
];
const SUMMARY_KEYS: (keyof SupplierFeedRunSummary)[] = [
  "read",
  "created",
  "updated",
  "unchanged",
  "skipped",
  "discontinued",
  "errors",
];
const SUMMARY_LABELS: Record<keyof SupplierFeedRunSummary, string> = {
  read: "Leidas",
  created: "Creadas",
  updated: "Actualizadas",
  unchanged: "Sin cambios",
  skipped: "Omitidas",
  discontinued: "Discontinuadas",
  errors: "Errores",
};

function connectionState(supplier: SupplierSummary): { tone: BadgeTone; label: string } {
  if (!supplier.isActive) return { tone: "muted", label: "Inactivo" };
  if (!supplier.hasApiConfig) return { tone: "warning", label: "Sin configurar" };
  return { tone: "success", label: "Conectado" };
}

function compactContact(person: string, email: string, phone: string): SupplierContact | null {
  const contact = {
    ...(person.trim() ? { person: person.trim() } : {}),
    ...(email.trim() ? { email: email.trim().toLowerCase() } : {}),
    ...(phone.trim() ? { phone: phone.trim() } : {}),
  };
  return Object.keys(contact).length > 0 ? contact : null;
}

function providerErrorToast(toast: ReturnType<typeof useToast>["toast"], title: string) {
  toast({ tone: "error", title, message: PROVIDER_ERROR });
}

function SummaryChips({ summary }: { summary: SupplierFeedRunSummary }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {SUMMARY_KEYS.map((key) => (
        <Badge key={key} tone={key === "errors" && summary[key] > 0 ? "danger" : "muted"}>
          {SUMMARY_LABELS[key]}: <span className="admin-mono">{summary[key]}</span>
        </Badge>
      ))}
    </div>
  );
}

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const supplierId = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("general");

  const supplier = useQuery({
    queryKey: ["suppliers", "detail", supplierId],
    queryFn: () => trpc.suppliers.get.query({ supplierId }),
    retry: false,
  });

  const invalidateSupplier = () => {
    qc.invalidateQueries({ queryKey: ["suppliers", "detail", supplierId] });
    qc.invalidateQueries({ queryKey: ["suppliers", "list"] });
  };

  if (supplier.isLoading) {
    return (
      <div className="admin-view">
        <Skeleton height={30} width={230} />
        <div style={{ marginTop: 20 }}>
          <Skeleton height={320} radius={14} />
        </div>
      </div>
    );
  }

  if (supplier.isError || !supplier.data) {
    return (
      <div className="admin-view">
        <div className="admin-panel admin-empty">
          <Truck size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
          <h4>Proveedor no encontrado</h4>
          <Button variant="secondary" onClick={() => router.push("/proveedores")} style={{ marginTop: 12 }}>
            Volver a proveedores
          </Button>
        </div>
      </div>
    );
  }

  const connection = connectionState(supplier.data);

  return (
    <div className="admin-view">
      <button className="admin-back" onClick={() => router.push("/proveedores")}>
        <ArrowLeft size={16} /> Volver a proveedores
      </button>

      <div className="admin-ph">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <h1>{supplier.data.name}</h1>
          <Badge tone={connection.tone}>{connection.label}</Badge>
        </div>
        <div className="admin-ph__actions">
          <div className="admin-segs">
            {[
              ["general", "General"],
              ["feed", "Feed"],
              ["map", "Mapeo"],
              ["orders", "Reenvio"],
            ].map(([value, label]) => (
              <button key={value} data-on={tab === value || undefined} onClick={() => setTab(value as Tab)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === "general" && <GeneralTab supplier={supplier.data} onChanged={invalidateSupplier} />}
      {tab === "feed" && <FeedTab supplierId={supplierId} />}
      {tab === "map" && <ProductMapTab supplierId={supplierId} />}
      {tab === "orders" && <OrderForwardingTab supplierId={supplierId} />}
    </div>
  );
}

function GeneralTab({ supplier, onChanged }: { supplier: SupplierSummary; onChanged: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [person, setPerson] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [authKind, setAuthKind] = useState<AuthKind>("api_key");
  const [apiKey, setApiKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);

  useEffect(() => {
    setName(supplier.name);
    setPerson(supplier.contact?.person ?? "");
    setEmail(supplier.contact?.email ?? "");
    setPhone(supplier.contact?.phone ?? "");
    setBaseUrl("");
    setApiKey("");
    setWebhookSecret("");
    setShowApiKey(false);
    setShowWebhook(false);
  }, [supplier]);

  const update = useMutation({
    mutationFn: () =>
      trpc.suppliers.update.mutate({
        supplierId: supplier.id,
        name: name.trim(),
        contact: compactContact(person, email, phone),
      }),
    onSuccess: () => {
      onChanged();
      toast({ tone: "success", title: "Datos guardados" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo guardar", message: err instanceof Error ? err.message : undefined }),
  });

  const setActive = useMutation({
    mutationFn: (isActive: boolean) => trpc.suppliers.setActive.mutate({ supplierId: supplier.id, isActive }),
    onSuccess: () => {
      onChanged();
      toast({ tone: "success", title: "Estado actualizado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo actualizar", message: err instanceof Error ? err.message : undefined }),
  });

  const setApiConfig = useMutation({
    mutationFn: () =>
      trpc.suppliers.setApiConfig.mutate({
        supplierId: supplier.id,
        apiConfig: {
          baseUrl: baseUrl.trim(),
          authKind,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(webhookSecret.trim() ? { webhookSecret: webhookSecret.trim() } : {}),
        },
      }),
    onSuccess: () => {
      onChanged();
      setBaseUrl("");
      setApiKey("");
      setWebhookSecret("");
      toast({ tone: "success", title: "Configuracion de API guardada" });
    },
    onError: () => providerErrorToast(toast, "No se pudo guardar la API"),
  });

  const needsWebhook = authKind === "hmac";
  const canSaveConfig =
    baseUrl.trim().length > 0 &&
    apiKey.trim().length >= 8 &&
    (!needsWebhook || webhookSecret.trim().length >= 16);

  return (
    <div className="admin-detail-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Informacion general</h3>
            <Button variant="primary" loading={update.isPending} disabled={!name.trim()} onClick={() => update.mutate()}>
              <Check size={16} /> Guardar
            </Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="admin-form-g">
              <span>Nombre</span>
              <input className="ui-input" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              <label className="admin-form-g">
                <span>Contacto</span>
                <input className="ui-input" value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Persona" />
              </label>
              <label className="admin-form-g">
                <span>Email</span>
                <input className="ui-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Opcional" />
              </label>
              <label className="admin-form-g">
                <span>Telefono</span>
                <input className="ui-input" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Opcional" />
              </label>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Configuracion de API</h3>
            <ShieldCheck size={17} style={{ color: "var(--admin-text-faint)" }} />
          </div>
          {supplier.hasApiConfig && (
            <div className="admin-info-strip">
              <ShieldCheck size={17} />
              Esto reemplaza la configuracion actual. Los secretos guardados nunca se muestran.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <label className="admin-form-g">
              <span>URL base</span>
              <input className="ui-input" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.proveedor.com" />
            </label>
            <label className="admin-form-g">
              <span>Autenticacion</span>
              <Select
                value={authKind}
                onChange={(event) => setAuthKind(event.target.value as AuthKind)}
                options={[
                  { value: "api_key", label: "API key" },
                  { value: "bearer", label: "Bearer token" },
                  { value: "hmac", label: "HMAC" },
                ]}
              />
            </label>
            <label className="admin-form-g">
              <span>API key / token</span>
              <span className="ui-input-wrap">
                <input
                  className="ui-input"
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={supplier.hasApiConfig ? "•••• configurado" : "Nuevo secreto"}
                  style={{ paddingRight: 42 }}
                />
                {apiKey.length > 0 && (
                  <button className="ui-icon-btn ui-input__trail" type="button" onClick={() => setShowApiKey((value) => !value)} aria-label="Mostrar secreto">
                    {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </span>
            </label>
            <label className="admin-form-g">
              <span>Webhook secret</span>
              <span className="ui-input-wrap">
                <input
                  className="ui-input"
                  type={showWebhook ? "text" : "password"}
                  value={webhookSecret}
                  onChange={(event) => setWebhookSecret(event.target.value)}
                  placeholder={supplier.hasApiConfig ? "•••• configurado" : "Opcional"}
                  style={{ paddingRight: 42 }}
                />
                {webhookSecret.length > 0 && (
                  <button className="ui-icon-btn ui-input__trail" type="button" onClick={() => setShowWebhook((value) => !value)} aria-label="Mostrar webhook secret">
                    {showWebhook ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                )}
              </span>
            </label>
            <Button variant="primary" loading={setApiConfig.isPending} disabled={!canSaveConfig} onClick={() => setApiConfig.mutate()}>
              Guardar credenciales
            </Button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="admin-panel">
          <div className="sc-lbl">Estado</div>
          <div className="admin-detail-kv">
            <span>Activo</span>
            <Switch checked={supplier.isActive} disabled={setActive.isPending} onCheckedChange={(checked) => setActive.mutate(Boolean(checked))} />
          </div>
          <div className="admin-detail-kv">
            <span>Credenciales</span>
            <Badge tone={supplier.hasApiConfig ? "success" : "warning"}>{supplier.hasApiConfig ? "Configuradas" : "Pendientes"}</Badge>
          </div>
        </div>

        <div className="admin-panel">
          <div className="sc-lbl">Metadatos</div>
          <div className="admin-detail-kv">
            <span>Slug</span>
            <b className="admin-mono" style={{ fontSize: 12 }}>{supplier.slug}</b>
          </div>
          <div className="admin-detail-kv">
            <span>Creado</span>
            <b>{formatDate(supplier.createdAt)}</b>
          </div>
          <div className="admin-detail-kv">
            <span>Actualizado</span>
            <b>{formatDate(supplier.updatedAt)}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedTab({ supplierId }: { supplierId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [kind, setKind] = useState<SupplierFeedKind>(SupplierFeedKind.CSV);
  const [sourceUrl, setSourceUrl] = useState("");
  const [schedule, setSchedule] = useState("");
  const [fieldMap, setFieldMap] = useState(DEFAULT_FIELD_MAP);
  const [runResult, setRunResult] = useState<FeedRunResult | null>(null);
  const [runTarget, setRunTarget] = useState<SupplierFeedRecord | null>(null);

  const feeds = useQuery({
    queryKey: ["suppliers", "feeds", supplierId],
    queryFn: () => trpc.suppliers.feeds.list.query({ supplierId }),
    retry: false,
  });

  useEffect(() => {
    const feed = feeds.data?.[0];
    if (!feed) return;
    setKind(feed.kind);
    setSourceUrl(feed.sourceUrl ?? "");
    setSchedule(feed.schedule ?? "");
    setFieldMap({ ...DEFAULT_FIELD_MAP, ...(feed.fieldMap ?? {}) });
  }, [feeds.data]);

  const invalidateFeeds = () => {
    qc.invalidateQueries({ queryKey: ["suppliers", "feeds", supplierId] });
  };

  const configure = useMutation({
    mutationFn: () =>
      trpc.suppliers.feeds.configure.mutate({
        supplierId,
        kind,
        ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}),
        ...(schedule.trim() ? { schedule: schedule.trim() } : {}),
        fieldMap,
      }),
    onSuccess: () => {
      invalidateFeeds();
      toast({ tone: "success", title: "Feed configurado" });
    },
    onError: () => providerErrorToast(toast, "No se pudo configurar el feed"),
  });

  const runFeed = useMutation({
    mutationFn: ({ feedId, dryRun }: { feedId: string; dryRun: boolean }) => trpc.suppliers.feeds.run.mutate({ feedId, dryRun }),
    onSuccess: (result) => {
      setRunResult(result);
      setRunTarget(null);
      invalidateFeeds();
      toast({ tone: "success", title: result.dryRun ? "Dry run finalizado" : "Feed ejecutado" });
    },
    onError: () => providerErrorToast(toast, "No se pudo ejecutar el feed"),
  });

  const firstFeed = feeds.data?.[0] ?? null;
  const canConfigure = kind === SupplierFeedKind.API || sourceUrl.trim().length > 0;

  return (
    <div className="admin-detail-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Configuracion de feed</h3>
            <Button variant="primary" loading={configure.isPending} disabled={!canConfigure} onClick={() => configure.mutate()}>
              <Check size={16} /> Guardar feed
            </Button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="admin-form-g">
                <span>Tipo</span>
                <Select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as SupplierFeedKind)}
                  options={[
                    { value: SupplierFeedKind.CSV, label: "CSV" },
                    { value: SupplierFeedKind.API, label: "API" },
                  ]}
                />
              </label>
              <label className="admin-form-g">
                <span>Cron</span>
                <input className="ui-input admin-mono" value={schedule} onChange={(event) => setSchedule(event.target.value)} placeholder="0 4 * * *" />
              </label>
            </div>
            <label className="admin-form-g">
              <span>URL de origen</span>
              <input className="ui-input" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://proveedor.com/feed.csv" />
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
              {FIELD_MAP_FIELDS.map((mapKey) => (
                <label className="admin-form-g" key={mapKey}>
                  <span>{mapKey}</span>
                  <input
                    className="ui-input admin-mono"
                    value={fieldMap[mapKey]}
                    onChange={(event) => setFieldMap((current) => ({ ...current, [mapKey]: event.target.value }))}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        {runResult && (
          <div className="admin-panel">
            <div className="admin-panel__h">
              <h3>Resumen de ultima corrida</h3>
              <StatusBadge status={runResult.status} />
            </div>
            <SummaryChips summary={runResult.summary} />
          </div>
        )}

        <div className="admin-tbl-card">
          {feeds.isLoading ? (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1].map((item) => <Skeleton key={item} height={44} radius={10} />)}
            </div>
          ) : feeds.isError ? (
            <div className="admin-empty">No se pudieron cargar los feeds</div>
          ) : (feeds.data ?? []).length === 0 ? (
            <div className="admin-empty">
              <Truck size={38} style={{ opacity: 0.5, marginBottom: 12 }} />
              <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin feeds configurados</div>
            </div>
          ) : (
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Feed</th>
                  <th>Estado</th>
                  <th>Ultima corrida</th>
                  <th>Resumen</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(feeds.data ?? []).map((feed) => (
                  <tr key={feed.id}>
                    <td>
                      <span className="admin-cell-str">{feed.kind.toUpperCase()}</span>
                      <span className="admin-cell-sub admin-mono">{feed.sourceUrl ?? "sin URL"}</span>
                    </td>
                    <td><StatusBadge status={feed.status} /></td>
                    <td className="admin-cell-sub">{feed.lastRunAt ? formatDate(feed.lastRunAt) : "-"}</td>
                    <td>{feed.lastRunSummary ? <SummaryChips summary={feed.lastRunSummary} /> : <span className="admin-cell-sub">Sin corridas</span>}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <Button variant="secondary" size="sm" loading={runFeed.isPending} onClick={() => runFeed.mutate({ feedId: feed.id, dryRun: true })}>
                          Dry run
                        </Button>
                        <Button variant="primary" size="sm" onClick={() => setRunTarget(feed)}>
                          <Play size={15} /> Ejecutar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="admin-panel">
        <div className="sc-lbl">Accion principal</div>
        {firstFeed ? (
          <>
            <div className="admin-detail-kv">
              <span>Feed activo</span>
              <StatusBadge status={firstFeed.status} />
            </div>
            <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
              <Button variant="secondary" loading={runFeed.isPending} onClick={() => runFeed.mutate({ feedId: firstFeed.id, dryRun: true })}>
                Dry run
              </Button>
              <Button variant="primary" onClick={() => setRunTarget(firstFeed)}>
                Ejecutar feed ahora
              </Button>
            </div>
          </>
        ) : (
          <div className="admin-cell-sub">Guarda la configuracion para habilitar ejecuciones.</div>
        )}
      </div>

      <Dialog open={runTarget !== null} onOpenChange={(open) => !open && setRunTarget(null)}>
        <DialogContent
          title="Ejecutar feed real"
          description="Esta accion dispara trafico saliente hacia el proveedor."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                variant="primary"
                loading={runFeed.isPending}
                onClick={() => runTarget && runFeed.mutate({ feedId: runTarget.id, dryRun: false })}
              >
                Confirmar ejecucion
              </Button>
            </>
          }
        >
          <div className="admin-cell-sub">
            El dry run no modifica catalogo. Esta corrida real puede crear, actualizar o discontinuar productos segun el feed.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductMapTab({ supplierId }: { supplierId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<SupplierSyncStatus | "all">("all");
  const [target, setTarget] = useState<SupplierProductMapRecord | null>(null);
  const [variantId, setVariantId] = useState("");

  const maps = useQuery({
    queryKey: ["suppliers", "map", supplierId, status],
    queryFn: () =>
      trpc.suppliers.map.list.query({
        supplierId,
        limit: 50,
        ...(status !== "all" ? { status } : {}),
      }),
    retry: false,
  });

  const link = useMutation({
    mutationFn: () => trpc.suppliers.map.link.mutate({ mapId: target!.id, variantId: variantId.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers", "map", supplierId] });
      toast({ tone: "success", title: "Variante vinculada" });
      setTarget(null);
      setVariantId("");
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo vincular", message: err instanceof Error ? err.message : undefined }),
  });

  const columns = useMemo<ColumnDef<SupplierProductMapRecord, unknown>[]>(
    () => [
      {
        id: "external",
        header: "Producto externo",
        cell: ({ row }) => (
          <span>
            <span className="admin-cell-str admin-mono">{row.original.externalId}</span>
            <span className="admin-cell-sub">Visto {row.original.lastSeenAt ? formatDate(row.original.lastSeenAt) : "-"}</span>
          </span>
        ),
      },
      {
        id: "variant",
        header: "Variante",
        cell: ({ row }) => <span className="admin-mono">{row.original.variantId ?? "sin vincular"}</span>,
      },
      { id: "status", header: "Estado", cell: ({ row }) => <StatusBadge status={row.original.syncStatus} /> },
      {
        id: "synced",
        header: "Sincronizado",
        cell: ({ row }) => <span className="admin-cell-sub">{row.original.syncedAt ? formatDate(row.original.syncedAt) : "-"}</span>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          !row.original.variantId ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setTarget(row.original);
              }}
            >
              <Link2 size={15} /> Vincular variante
            </Button>
          ) : null,
      },
    ],
    [],
  );

  return (
    <>
      <div className="admin-tbl-card">
        <div className="admin-toolbar">
          {[
            ["all", "Todos"],
            [SupplierSyncStatus.PENDING_REVIEW, "A revisar"],
            [SupplierSyncStatus.CONFLICT, "Conflicto"],
            [SupplierSyncStatus.LINKED, "Vinculados"],
            [SupplierSyncStatus.DISCONTINUED, "Discontinuados"],
          ].map(([value, label]) => (
            <span key={value} className="admin-chip" data-on={status === value || undefined} onClick={() => setStatus(value as SupplierSyncStatus | "all")}>
              {label}
            </span>
          ))}
        </div>
        {maps.isError ? (
          <div className="admin-empty">No se pudo cargar el mapeo</div>
        ) : (
          <DataTable
            columns={columns}
            data={maps.data?.items ?? []}
            loading={maps.isLoading}
            emptyState={
              <div>
                <Link2 size={38} style={{ opacity: 0.5, marginBottom: 12 }} />
                <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin productos mapeados</div>
              </div>
            }
          />
        )}
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent
          title="Vincular variante"
          description={target?.externalId}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="primary" loading={link.isPending} disabled={!UUID_RE.test(variantId)} onClick={() => link.mutate()}>
                Vincular
              </Button>
            </>
          }
        >
          <label className="admin-form-g">
            <span>Variant ID</span>
            <input className="ui-input admin-mono" value={variantId} onChange={(event) => setVariantId(event.target.value)} placeholder="UUID de variante" />
          </label>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OrderForwardingTab({ supplierId }: { supplierId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [orderId, setOrderId] = useState("");
  const [searchedOrderId, setSearchedOrderId] = useState("");
  const [target, setTarget] = useState<SupplierOrderRefRecord | null>(null);

  const refs = useQuery({
    queryKey: ["suppliers", "orderRefs", searchedOrderId],
    queryFn: () => trpc.suppliers.orders.refs.query({ orderId: searchedOrderId }),
    enabled: UUID_RE.test(searchedOrderId),
    retry: false,
  });

  const retryForward = useMutation({
    mutationFn: () => trpc.suppliers.orders.retryForward.mutate({ orderId: target!.orderId, supplierId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers", "orderRefs", searchedOrderId] });
      toast({ tone: "success", title: "Reenvio solicitado" });
      setTarget(null);
    },
    onError: () => providerErrorToast(toast, "No se pudo reenviar el pedido"),
  });

  const rows = (refs.data ?? []).filter((ref) => ref.supplierId === supplierId);

  return (
    <>
      <div className="admin-panel" style={{ marginBottom: 16 }}>
        <div className="admin-panel__h">
          <h3>Buscar reenvios por pedido</h3>
        </div>
        {/* El backend aun no expone un listado por proveedor; esta vista consulta por orderId. */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label className="admin-form-g" style={{ minWidth: 320, flex: "1 1 320px" }}>
            <span>Order ID</span>
            <input className="ui-input admin-mono" value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="UUID de pedido" />
          </label>
          <Button variant="primary" disabled={!UUID_RE.test(orderId)} onClick={() => setSearchedOrderId(orderId.trim())}>
            <Search size={16} /> Buscar
          </Button>
        </div>
      </div>

      <div className="admin-tbl-card">
        {refs.isLoading ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((item) => <Skeleton key={item} height={44} radius={10} />)}
          </div>
        ) : refs.isError ? (
          <div className="admin-empty">No se pudieron cargar los reenvios</div>
        ) : !searchedOrderId ? (
          <div className="admin-empty">Busca un pedido para ver sus referencias de proveedor.</div>
        ) : rows.length === 0 ? (
          <div className="admin-empty">Sin referencias para este proveedor.</div>
        ) : (
          <table className="ui-table">
            <thead>
              <tr>
                <th>Pedido externo</th>
                <th>Estado</th>
                <th>Intentos</th>
                <th>Ultimo error</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((ref) => (
                <tr key={ref.id}>
                  <td>
                    <span className="admin-cell-str admin-mono">{ref.externalOrderId ?? "sin externo"}</span>
                    <span className="admin-cell-sub">{formatDate(ref.updatedAt)}</span>
                  </td>
                  <td><StatusBadge status={ref.status} /></td>
                  <td className="admin-mono">{ref.attempts}</td>
                  <td className="admin-cell-sub">{ref.lastError ? PROVIDER_ERROR : "-"}</td>
                  <td style={{ textAlign: "right" }}>
                    {ref.status !== SupplierForwardStatus.ACCEPTED && (
                      <Button variant="secondary" size="sm" onClick={() => setTarget(ref)}>
                        <RefreshCw size={15} /> Reintentar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent
          title="Reintentar reenvio"
          description="Esta accion dispara trafico saliente hacia el proveedor."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="primary" loading={retryForward.isPending} onClick={() => target && retryForward.mutate()}>
                Confirmar reenvio
              </Button>
            </>
          }
        >
          <p className="admin-mono" style={{ fontSize: 12.5, color: "var(--admin-text-muted)" }}>
            {target?.orderId}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
