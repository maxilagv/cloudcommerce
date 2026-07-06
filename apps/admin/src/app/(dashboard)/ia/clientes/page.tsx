"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserRound,
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
  Switch,
  useToast,
  type BadgeTone,
  type ColumnDef,
} from "@cloudcommerce/ui";
import {
  AiConversationStatus,
  AiMessageAuthor,
  AiMessageDirection,
  AiMessageStatus,
  type AiConversationDetail,
  type AiConversationListResult,
  type AiConversationSummary,
  type AiMessageRecord,
  type AiOutreachGoal,
  type AiOutreachResult,
  type CustomerAiProfileListResult,
  type CustomerAiProfileView,
} from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatDate } from "@/lib/format";

/**
 * AiMessageStatus / AiConversationStatus colisionan con claves ya mapeadas en
 * StatusBadge (PENDING, SENT, DELIVERED, FAILED, PAUSED), así que acá usamos
 * Badges inline con labels locales en lugar de tocar el mapa central.
 */
const CONVERSATION_STATUS: Record<AiConversationStatus, { tone: BadgeTone; label: string }> = {
  [AiConversationStatus.ACTIVE]: { tone: "success", label: "Activa" },
  [AiConversationStatus.PAUSED]: { tone: "warning", label: "Pausada" },
  [AiConversationStatus.CLOSED]: { tone: "muted", label: "Cerrada" },
};

const MESSAGE_STATUS_LABEL: Record<AiMessageStatus, string> = {
  [AiMessageStatus.PENDING]: "Pendiente",
  [AiMessageStatus.SENT]: "Enviado",
  [AiMessageStatus.DELIVERED]: "Entregado",
  [AiMessageStatus.READ]: "Leído",
  [AiMessageStatus.FAILED]: "Falló",
  [AiMessageStatus.RECEIVED]: "Recibido",
};

const GOAL_OPTIONS: { value: AiOutreachGoal; label: string }[] = [
  { value: "follow_up", label: "Seguimiento" },
  { value: "cross_sell", label: "Venta cruzada" },
  { value: "win_back", label: "Recuperar cliente" },
  { value: "new_arrival", label: "Novedades" },
  { value: "post_purchase", label: "Post venta" },
];

const PRICE_SENSITIVITY_LABEL: Record<CustomerAiProfileView["priceSensitivity"], string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

type ConversationFilter = "all" | "human" | "paused";
type Tab = "conversaciones" | "perfiles";

function MessageStatusTicks({ status }: { status: AiMessageStatus }) {
  const base = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11 } as const;
  if (status === AiMessageStatus.FAILED) {
    return (
      <span style={{ ...base, color: "var(--admin-danger)" }}>
        <AlertCircle size={12} /> {MESSAGE_STATUS_LABEL[status]}
      </span>
    );
  }
  const icon =
    status === AiMessageStatus.PENDING ? (
      <Clock size={12} />
    ) : status === AiMessageStatus.SENT ? (
      <Check size={12} />
    ) : (
      <CheckCheck size={12} />
    );
  const color = status === AiMessageStatus.READ ? "var(--admin-accent)" : "var(--admin-text-faint)";
  return (
    <span style={{ ...base, color }}>
      {icon} {MESSAGE_STATUS_LABEL[status]}
    </span>
  );
}

export default function AiSellerPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("conversaciones");
  const [filter, setFilter] = useState<ConversationFilter>("all");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [outreachOpen, setOutreachOpen] = useState(false);
  const [profileQ, setProfileQ] = useState("");

  const conversations = useQuery<AiConversationListResult>({
    queryKey: ["ai", "engagement", "conversations", filter],
    queryFn: () =>
      trpc.engagement.listConversations.query({
        limit: 50,
        ...(filter === "human" ? { needsHuman: true } : {}),
        ...(filter === "paused" ? { status: AiConversationStatus.PAUSED } : {}),
      }),
    refetchInterval: 15_000,
    retry: false,
  });

  const detail = useQuery<AiConversationDetail>({
    queryKey: ["ai", "engagement", "conversation", selectedConversationId],
    queryFn: () => trpc.engagement.getConversation.query({ conversationId: selectedConversationId!, limit: 100 }),
    enabled: selectedConversationId !== null,
    refetchInterval: 15_000,
    retry: false,
  });

  const profile = useQuery<CustomerAiProfileView | null>({
    queryKey: ["ai", "engagement", "profile", selectedCustomerId],
    queryFn: () => trpc.engagement.getProfile.query({ customerId: selectedCustomerId! }),
    enabled: selectedCustomerId !== null,
    retry: false,
  });

  const profiles = useQuery<CustomerAiProfileListResult>({
    queryKey: ["ai", "engagement", "profiles", profileQ],
    queryFn: () => trpc.engagement.listProfiles.query({ limit: 50, ...(profileQ.trim() ? { q: profileQ.trim() } : {}) }),
    enabled: tab === "perfiles",
    retry: false,
  });

  const invalidateConversations = () => {
    qc.invalidateQueries({ queryKey: ["ai", "engagement", "conversations"] });
    qc.invalidateQueries({ queryKey: ["ai", "engagement", "conversation"] });
  };

  const send = useMutation({
    mutationFn: (content: string): Promise<AiMessageRecord> =>
      trpc.engagement.sendMessage.mutate({ conversationId: selectedConversationId!, content }),
    onSuccess: () => {
      setDraft("");
      invalidateConversations();
      toast({ tone: "success", title: "Mensaje enviado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo enviar", message: err instanceof Error ? err.message : undefined }),
  });

  const updateConversation = useMutation({
    mutationFn: (patch: { autopilot?: boolean; status?: AiConversationStatus; needsHuman?: boolean }) =>
      trpc.engagement.updateConversation.mutate({ conversationId: selectedConversationId!, ...patch }),
    onSuccess: () => {
      invalidateConversations();
      toast({ tone: "success", title: "Conversación actualizada" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo actualizar", message: err instanceof Error ? err.message : undefined }),
  });

  const analyze = useMutation({
    mutationFn: (): Promise<CustomerAiProfileView> =>
      trpc.engagement.analyzeCustomer.mutate({ customerId: selectedCustomerId!, idempotencyKey: crypto.randomUUID() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai", "engagement", "profile"] });
      qc.invalidateQueries({ queryKey: ["ai", "engagement", "profiles"] });
      toast({ tone: "success", title: "Perfil reanalizado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo analizar", message: err instanceof Error ? err.message : undefined }),
  });

  function selectConversation(item: AiConversationSummary) {
    setSelectedConversationId(item.id);
    setSelectedCustomerId(item.customerId);
    setDraft("");
  }

  function selectProfileRow(row: CustomerAiProfileView) {
    setSelectedCustomerId(row.customerId);
    const conversation = conversations.data?.items.find((item) => item.customerId === row.customerId) ?? null;
    setSelectedConversationId(conversation?.id ?? null);
    setProfileOpen(true);
    setTab("conversaciones");
  }

  const currentProfile = profile.data ?? detail.data?.profile ?? null;
  const conversation = detail.data?.conversation ?? null;

  const profileColumns = useMemo<ColumnDef<CustomerAiProfileView, unknown>[]>(
    () => [
      {
        id: "customer",
        header: "Cliente",
        cell: ({ row }) => (
          <span>
            <span className="admin-cell-str">{row.original.customerName}</span>
            <span className="admin-cell-sub admin-mono">{row.original.whatsapp ?? "Sin WhatsApp"}</span>
          </span>
        ),
      },
      {
        id: "interests",
        header: "Intereses",
        cell: ({ row }) => (
          <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
            {row.original.interests.length === 0 ? (
              <span className="admin-cell-sub">—</span>
            ) : (
              <>
                {row.original.interests.slice(0, 3).map((interest) => (
                  <Badge key={interest} tone="info">{interest}</Badge>
                ))}
                {row.original.interests.length > 3 && <Badge tone="muted">+{row.original.interests.length - 3}</Badge>}
              </>
            )}
          </span>
        ),
      },
      {
        id: "segments",
        header: "Segmentos",
        cell: ({ row }) => <span className="admin-cell-sub">{row.original.segments.join(", ") || "—"}</span>,
      },
      {
        id: "confidence",
        header: "Confianza",
        cell: ({ row }) => <span className="admin-mono">{Math.round(row.original.confidence * 100)}%</span>,
      },
      {
        id: "analyzed",
        header: "Último análisis",
        cell: ({ row }) => (
          <span className="admin-cell-sub">{row.original.lastAnalyzedAt ? formatDate(row.original.lastAnalyzedAt) : "Nunca"}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="admin-view">
      <Link className="admin-back" href="/ia">
        <ArrowLeft size={16} /> Volver a IA
      </Link>

      <div className="admin-ph">
        <div>
          <h1>Vendedor IA</h1>
          <div className="admin-ph__sub">Conversaciones de WhatsApp, perfiles de clientes y mensajes proactivos con IA.</div>
        </div>
        <div className="admin-ph__actions">
          <div className="admin-segs">
            <button data-on={tab === "conversaciones" || undefined} onClick={() => setTab("conversaciones")}>Conversaciones</button>
            <button data-on={tab === "perfiles" || undefined} onClick={() => setTab("perfiles")}>Perfiles</button>
          </div>
        </div>
      </div>

      {tab === "perfiles" ? (
        <div className="admin-tbl-card">
          <div className="admin-toolbar">
            <span className="ui-input-wrap" style={{ maxWidth: 320 }}>
              <span className="ui-input__lead"><Search size={15} /></span>
              <input
                className="ui-input ui-input--lead"
                value={profileQ}
                onChange={(event) => setProfileQ(event.target.value)}
                placeholder="Buscar cliente"
              />
            </span>
          </div>
          {profiles.isError ? (
            <div className="admin-empty">No se pudieron cargar los perfiles.</div>
          ) : (
            <DataTable
              columns={profileColumns}
              data={profiles.data?.items ?? []}
              loading={profiles.isLoading}
              onRowClick={selectProfileRow}
              emptyState={
                <div>
                  <UserRound size={38} style={{ opacity: 0.5, marginBottom: 12 }} />
                  <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Sin perfiles analizados</div>
                  <div className="admin-cell-sub">Analizá un cliente desde su conversación para generar el perfil.</div>
                </div>
              }
            />
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, alignItems: "start" }}>
          {/* Lista de conversaciones */}
          <div className="admin-panel" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--admin-border-subtle)" }}>
              <div className="admin-segs">
                <button data-on={filter === "all" || undefined} onClick={() => setFilter("all")}>Todas</button>
                <button data-on={filter === "human" || undefined} onClick={() => setFilter("human")}>Necesitan humano</button>
                <button data-on={filter === "paused" || undefined} onClick={() => setFilter("paused")}>Pausadas</button>
              </div>
            </div>
            <div style={{ maxHeight: 620, overflowY: "auto" }}>
              {conversations.isLoading ? (
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {[0, 1, 2, 3].map((item) => <Skeleton key={item} height={58} radius={10} />)}
                </div>
              ) : conversations.isError ? (
                <div className="admin-empty" style={{ padding: "38px 14px" }}>No se pudieron cargar las conversaciones.</div>
              ) : (conversations.data?.items ?? []).length === 0 ? (
                <div className="admin-empty" style={{ padding: "38px 14px" }}>
                  <MessageCircle size={34} style={{ opacity: 0.5, marginBottom: 10 }} />
                  Sin conversaciones por acá.
                </div>
              ) : (
                (conversations.data?.items ?? []).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectConversation(item)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 14px",
                      border: "none",
                      borderBottom: "1px solid var(--admin-border-subtle)",
                      background: item.id === selectedConversationId ? "var(--admin-bg-selected)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span className="admin-cell-str" style={{ display: "block" }}>{item.customerName}</span>
                      <span style={{ display: "inline-flex", gap: 5, flexShrink: 0 }}>
                        {item.autopilot && <Badge tone="info">Auto</Badge>}
                        {item.needsHuman && <Badge tone="danger">Atención</Badge>}
                      </span>
                    </div>
                    <div className="admin-cell-sub admin-mono">{item.whatsapp ?? "Sin WhatsApp"}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
                      <span
                        className="admin-cell-sub"
                        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}
                      >
                        {item.lastMessagePreview ?? "Sin mensajes"}
                      </span>
                      {item.lastMessageAt && (
                        <span className="admin-cell-sub" style={{ flexShrink: 0 }}>{formatDate(item.lastMessageAt)}</span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Conversación seleccionada */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!selectedConversationId && !selectedCustomerId ? (
              <div className="admin-panel admin-empty" style={{ padding: "72px 20px" }}>
                <MessageCircle size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
                <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Elegí una conversación</div>
                <div className="admin-cell-sub">Seleccioná un chat de la lista para leerlo y responder.</div>
              </div>
            ) : (
              <>
                {selectedConversationId && (
                  <div className="admin-panel" style={{ display: "flex", flexDirection: "column", gap: 0, padding: 0, overflow: "hidden" }}>
                    {/* Header del chat */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        padding: "14px 16px",
                        borderBottom: "1px solid var(--admin-border-subtle)",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 15 }}>{conversation?.customerName ?? "Conversación"}</span>
                          {conversation && (
                            <Badge tone={CONVERSATION_STATUS[conversation.status].tone}>
                              {CONVERSATION_STATUS[conversation.status].label}
                            </Badge>
                          )}
                          {conversation?.needsHuman && <Badge tone="danger">Atención</Badge>}
                        </div>
                        {conversation?.whatsapp && <div className="admin-cell-sub admin-mono">{conversation.whatsapp}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                          <Switch
                            checked={conversation?.autopilot ?? false}
                            disabled={!conversation || updateConversation.isPending}
                            onCheckedChange={(checked) => updateConversation.mutate({ autopilot: checked })}
                          />
                          <span style={{ fontSize: 12.5, color: "var(--admin-text-secondary)" }}>Autopilot</span>
                        </label>
                        <Select
                          value={conversation?.status ?? AiConversationStatus.ACTIVE}
                          disabled={!conversation || updateConversation.isPending}
                          onChange={(event) => updateConversation.mutate({ status: event.target.value as AiConversationStatus })}
                          options={[
                            { value: AiConversationStatus.ACTIVE, label: "Activa" },
                            { value: AiConversationStatus.PAUSED, label: "Pausada" },
                            { value: AiConversationStatus.CLOSED, label: "Cerrada" },
                          ]}
                        />
                        {conversation?.needsHuman && (
                          <Button
                            variant="secondary"
                            size="sm"
                            loading={updateConversation.isPending}
                            onClick={() => updateConversation.mutate({ needsHuman: false })}
                          >
                            <Check size={15} /> Marcar resuelto
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => setProfileOpen((open) => !open)}>
                          <UserRound size={15} /> Perfil
                        </Button>
                      </div>
                    </div>

                    {/* Hilo */}
                    <MessageThread messages={detail.data?.messages ?? []} loading={detail.isLoading} error={detail.isError} />

                    {/* Composer */}
                    <div style={{ display: "flex", gap: 10, padding: "12px 16px", borderTop: "1px solid var(--admin-border-subtle)" }}>
                      <textarea
                        className="ui-input"
                        rows={2}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Escribí una respuesta para el cliente…"
                        style={{ resize: "none" }}
                      />
                      <Button
                        variant="primary"
                        loading={send.isPending}
                        disabled={draft.trim().length === 0}
                        onClick={() => send.mutate(draft.trim())}
                        style={{ alignSelf: "flex-end" }}
                      >
                        <Send size={15} /> Enviar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Perfil IA del cliente */}
                {(profileOpen || !selectedConversationId) && selectedCustomerId && (
                  <ProfilePanel
                    profile={currentProfile}
                    loading={profile.isLoading}
                    analyzing={analyze.isPending}
                    onAnalyze={() => analyze.mutate()}
                    onOutreach={() => setOutreachOpen(true)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {selectedCustomerId && (
        <OutreachDialog
          open={outreachOpen}
          onClose={() => setOutreachOpen(false)}
          customerId={selectedCustomerId}
          customerName={currentProfile?.customerName ?? conversation?.customerName ?? "Cliente"}
          onSent={invalidateConversations}
        />
      )}
    </div>
  );
}

function MessageThread({ messages, loading, error }: { messages: AiMessageRecord[]; loading: boolean; error: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (loading) {
    return (
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
        <Skeleton height={44} width="60%" radius={12} />
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Skeleton height={44} width="55%" radius={12} />
        </div>
        <Skeleton height={44} width="65%" radius={12} />
      </div>
    );
  }

  if (error) {
    return <div className="admin-empty" style={{ padding: "44px 16px" }}>No se pudo cargar la conversación.</div>;
  }

  if (messages.length === 0) {
    return <div className="admin-empty" style={{ padding: "44px 16px" }}>Todavía no hay mensajes en esta conversación.</div>;
  }

  return (
    <div ref={scrollRef} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, maxHeight: 440, overflowY: "auto" }}>
      {messages.map((message) => {
        const fromCustomer = message.author === AiMessageAuthor.CUSTOMER;
        return (
          <div key={message.id} style={{ display: "flex", justifyContent: fromCustomer ? "flex-start" : "flex-end" }}>
            <div
              style={{
                maxWidth: "72%",
                padding: "9px 12px",
                borderRadius: 12,
                borderBottomLeftRadius: fromCustomer ? 4 : 12,
                borderBottomRightRadius: fromCustomer ? 12 : 4,
                background: fromCustomer ? "var(--admin-bg-inset)" : "var(--admin-accent-soft)",
                border: fromCustomer ? "1px solid var(--admin-border-subtle)" : "1px solid var(--admin-accent-border)",
              }}
            >
              {!fromCustomer && (
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--admin-accent)", marginBottom: 2 }}>
                  {message.author === AiMessageAuthor.AI ? "IA" : "Vos"}
                </div>
              )}
              <div style={{ fontSize: 13, color: "var(--admin-text-primary)", whiteSpace: "pre-wrap" }}>{message.content}</div>
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 10.5, color: "var(--admin-text-faint)" }}>{formatDate(message.createdAt)}</span>
                {message.direction === AiMessageDirection.OUT && <MessageStatusTicks status={message.status} />}
              </div>
              {message.status === AiMessageStatus.FAILED && message.errorMessage && (
                <div style={{ fontSize: 11, color: "var(--admin-danger)", marginTop: 2 }}>{message.errorMessage}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProfilePanel({
  profile,
  loading,
  analyzing,
  onAnalyze,
  onOutreach,
}: {
  profile: CustomerAiProfileView | null;
  loading: boolean;
  analyzing: boolean;
  onAnalyze: () => void;
  onOutreach: () => void;
}) {
  return (
    <div className="admin-panel">
      <div className="admin-panel__h">
        <h3>Perfil IA del cliente</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" loading={analyzing} onClick={onAnalyze}>
            <RefreshCw size={14} /> {profile ? "Reanalizar" : "Analizar"}
          </Button>
          <Button variant="primary" size="sm" onClick={onOutreach}>
            <Sparkles size={14} /> Generar mensaje
          </Button>
        </div>
      </div>

      {loading ? (
        <Skeleton height={140} radius={12} />
      ) : !profile ? (
        <div className="admin-cell-sub">
          Este cliente todavía no tiene perfil IA. Tocá &quot;Analizar&quot; para generar intereses, segmentos y próximas acciones.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="admin-cell-sub">{profile.summary}</div>

          <div>
            <div className="sc-lbl">Intereses</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {profile.interests.length === 0 ? (
                <span className="admin-cell-sub">—</span>
              ) : (
                profile.interests.map((interest) => <Badge key={interest} tone="info">{interest}</Badge>)
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <div className="sc-lbl">Segmentos</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {profile.segments.length === 0 ? (
                  <span className="admin-cell-sub">—</span>
                ) : (
                  profile.segments.map((segment) => <Badge key={segment} tone="muted">{segment}</Badge>)
                )}
              </div>
            </div>
            <div>
              <div className="admin-detail-kv">
                <span>Sensibilidad al precio</span>
                <b>{PRICE_SENSITIVITY_LABEL[profile.priceSensitivity]}</b>
              </div>
              <div className="admin-detail-kv">
                <span>Confianza</span>
                <b className="admin-mono">{Math.round(profile.confidence * 100)}%</b>
              </div>
              <div className="admin-detail-kv">
                <span>Último análisis</span>
                <b>{profile.lastAnalyzedAt ? formatDate(profile.lastAnalyzedAt) : "Nunca"}</b>
              </div>
            </div>
          </div>

          {profile.nextBestActions.length > 0 && (
            <div>
              <div className="sc-lbl">Próximas acciones sugeridas</div>
              <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12.5, color: "var(--admin-text-secondary)" }}>
                {profile.nextBestActions.map((action) => <li key={action}>{action}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OutreachDialog({
  open,
  onClose,
  customerId,
  customerName,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  customerId: string;
  customerName: string;
  onSent: () => void;
}) {
  const { toast } = useToast();
  const [goal, setGoal] = useState<AiOutreachGoal>("follow_up");
  const [message, setMessage] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [recommendedCount, setRecommendedCount] = useState(0);

  useEffect(() => {
    if (!open) return;
    setGoal("follow_up");
    setMessage("");
    setReasoning("");
    setRecommendedCount(0);
  }, [open, customerId]);

  const preview = useMutation({
    mutationFn: (): Promise<AiOutreachResult> =>
      trpc.engagement.generateOutreach.mutate({ customerId, goal, send: false, idempotencyKey: crypto.randomUUID() }),
    onSuccess: (result) => {
      setMessage(result.message);
      setReasoning(result.reasoning);
      setRecommendedCount(result.recommendedProductIds.length);
      toast({ tone: "success", title: "Borrador generado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo generar", message: err instanceof Error ? err.message : undefined }),
  });

  // Enviamos SIEMPRE el texto editado vía sendMessage para que las correcciones del admin ganen.
  const sendEdited = useMutation({
    mutationFn: (): Promise<AiMessageRecord> => trpc.engagement.sendMessage.mutate({ customerId, content: message.trim() }),
    onSuccess: () => {
      onSent();
      toast({ tone: "success", title: "Mensaje enviado por WhatsApp" });
      onClose();
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo enviar", message: err instanceof Error ? err.message : undefined }),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        title="Generar mensaje con IA"
        description={`Mensaje proactivo para ${customerName}. Revisalo y editalo antes de enviar.`}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost">Cancelar</Button>
            </DialogClose>
            <Button
              variant="primary"
              loading={sendEdited.isPending}
              disabled={message.trim().length === 0 || preview.isPending}
              onClick={() => sendEdited.mutate()}
            >
              <Send size={15} /> Enviar por WhatsApp
            </Button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <label className="admin-form-g" style={{ flex: 1 }}>
              <span>Objetivo</span>
              <Select value={goal} onChange={(event) => setGoal(event.target.value as AiOutreachGoal)} options={GOAL_OPTIONS} />
            </label>
            <Button variant="secondary" loading={preview.isPending} onClick={() => preview.mutate()}>
              <Sparkles size={15} /> {message ? "Regenerar" : "Generar borrador"}
            </Button>
          </div>

          {preview.isPending ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Skeleton height={16} width="75%" />
              <Skeleton height={90} radius={12} />
            </div>
          ) : message ? (
            <>
              <label className="admin-form-g">
                <span>Mensaje (editable)</span>
                <textarea className="ui-input" rows={6} value={message} onChange={(event) => setMessage(event.target.value)} />
              </label>
              {reasoning && (
                <details>
                  <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--admin-text-muted)" }}>Por qué este mensaje</summary>
                  <div className="admin-cell-sub" style={{ marginTop: 6 }}>{reasoning}</div>
                </details>
              )}
              {recommendedCount > 0 && <Badge tone="info">{recommendedCount} producto(s) recomendados</Badge>}
            </>
          ) : (
            <div className="admin-empty" style={{ padding: "26px 0" }}>Elegí un objetivo y generá un borrador para empezar.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
