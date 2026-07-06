"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Package, RefreshCw, Truck, UserRound, XCircle } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Select,
  Skeleton,
  StatusBadge,
  useToast,
} from "@cloudcommerce/ui";
import {
  OrderStatus,
  type OrderDetail,
  type OrderLineView,
  type ShipmentView,
  type TrackingView,
} from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatDate, formatMinor } from "@/lib/format";

type TransitionTarget = { status: OrderStatus; label: string; reasonRequired?: boolean };

const ALL_STATUSES = Object.values(OrderStatus);

const COMMON_TRANSITIONS: Partial<Record<OrderStatus, TransitionTarget[]>> = {
  [OrderStatus.DRAFT]: [{ status: OrderStatus.PENDING_CONFIRMATION, label: "Enviar a pendiente" }],
  [OrderStatus.PENDING_CONFIRMATION]: [{ status: OrderStatus.CONFIRMED, label: "Confirmar pedido" }],
  [OrderStatus.CONFIRMED]: [{ status: OrderStatus.PREPARING, label: "Marcar preparando" }],
  [OrderStatus.PREPARING]: [{ status: OrderStatus.READY_TO_SHIP, label: "Listo para envio" }],
  [OrderStatus.READY_TO_SHIP]: [{ status: OrderStatus.SHIPPED, label: "Marcar enviado" }],
  [OrderStatus.SHIPPED]: [{ status: OrderStatus.DELIVERED, label: "Marcar entregado" }],
  [OrderStatus.DELIVERED]: [{ status: OrderStatus.RETURN_REQUESTED, label: "Solicitar devolucion", reasonRequired: true }],
  [OrderStatus.RETURN_REQUESTED]: [{ status: OrderStatus.RETURNED, label: "Marcar devuelto" }],
};

function needsReason(status: OrderStatus): boolean {
  return status === OrderStatus.CANCELLED || status === OrderStatus.RETURN_REQUESTED;
}

function money(value?: { amountMinor: number } | null): string {
  return value ? formatMinor(value.amountMinor) : "-";
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [transitionTarget, setTransitionTarget] = useState<TransitionTarget | null>(null);
  const [otherStatus, setOtherStatus] = useState<OrderStatus>(OrderStatus.CONFIRMED);
  const [reason, setReason] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [shipment, setShipment] = useState<ShipmentView | TrackingView | null>(null);
  const [shippingDialog, setShippingDialog] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [trackingCode, setTrackingCode] = useState("");
  const [eta, setEta] = useState("");

  const query = useQuery({
    queryKey: ["orders", "detail", orderId],
    queryFn: () => trpc.orders.get.query({ orderId }),
    retry: false,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["orders", "detail", orderId] });
    qc.invalidateQueries({ queryKey: ["orders", "list"] });
  };

  const transition = useMutation({
    mutationFn: ({ toStatus, reason }: { toStatus: OrderStatus; reason?: string }) =>
      trpc.orders.transition.mutate({ orderId, toStatus, ...(reason?.trim() ? { reason: reason.trim() } : {}) }),
    onSuccess: () => {
      invalidate();
      toast({ tone: "success", title: "Estado actualizado" });
      setTransitionTarget(null);
      setReason("");
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo cambiar el estado", message: err instanceof Error ? err.message : undefined }),
  });

  const cancel = useMutation({
    mutationFn: () => trpc.orders.cancel.mutate({ orderId, reason: reason.trim() }),
    onSuccess: () => {
      invalidate();
      toast({ tone: "success", title: "Pedido cancelado" });
      setCanceling(false);
      setReason("");
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo cancelar", message: err instanceof Error ? err.message : undefined }),
  });

  const createShipment = useMutation({
    mutationFn: () =>
      trpc.orders.createShipment.mutate({
        orderId,
        ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
        ...(trackingCode.trim() ? { trackingCode: trackingCode.trim() } : {}),
        ...(eta ? { eta: new Date(eta) } : {}),
      }),
    onSuccess: (created) => {
      // TODO(backend): falta orders.getShipmentByOrderId; se conserva localmente hasta recargar la pagina.
      setShipment(created);
      toast({ tone: "success", title: "Envio creado" });
      setShippingDialog(false);
      setCarrier("");
      setTrackingCode("");
      setEta("");
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo crear el envio", message: err instanceof Error ? err.message : undefined }),
  });

  const refreshTracking = useMutation({
    mutationFn: (shipmentId: string) => trpc.orders.refreshTracking.mutate({ shipmentId }),
    onSuccess: (tracking) => {
      setShipment(tracking);
      toast({ tone: tracking.stale ? "warning" : "success", title: tracking.stale ? "Tracking sin actualizar" : "Tracking actualizado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo refrescar", message: err instanceof Error ? err.message : undefined }),
  });

  if (query.isLoading) {
    return (
      <div className="admin-view">
        <Skeleton height={30} width={230} />
        <div style={{ marginTop: 20 }}>
          <Skeleton height={320} radius={14} />
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="admin-view">
        <div className="admin-panel admin-empty">
          <Package size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
          <h4>Pedido no encontrado</h4>
          <Button variant="secondary" onClick={() => router.push("/pedidos")} style={{ marginTop: 12 }}>
            Volver a pedidos
          </Button>
        </div>
      </div>
    );
  }

  const order = query.data;
  const commonTransitions = COMMON_TRANSITIONS[order.status] ?? [];
  const canCancel = ![OrderStatus.CANCELLED, OrderStatus.DELIVERED, OrderStatus.RETURNED].includes(order.status);

  return (
    <div className="admin-view">
      <button className="admin-back" onClick={() => router.push("/pedidos")}>
        <ArrowLeft size={16} /> Volver a pedidos
      </button>

      <div className="admin-ph">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <h1>{order.orderNumber}</h1>
          <StatusBadge status={order.status} />
        </div>
        <div className="admin-ph__actions">
          {commonTransitions.map((item) => (
            <Button
              key={item.status}
              variant="secondary"
              onClick={() => (item.reasonRequired ? setTransitionTarget(item) : transition.mutate({ toStatus: item.status }))}
            >
              <Check size={16} /> {item.label}
            </Button>
          ))}
          <Button variant="secondary" onClick={() => setTransitionTarget({ status: otherStatus, label: "Otro estado", reasonRequired: needsReason(otherStatus) })}>
            Otro estado
          </Button>
          {canCancel && (
            <Button variant="danger" onClick={() => setCanceling(true)}>
              <XCircle size={16} /> Cancelar
            </Button>
          )}
        </div>
      </div>

      <div className="admin-detail-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-panel">
            <div className="admin-panel__h">
              <h3>Lineas del pedido</h3>
              <Badge tone="info">{order.lines.length} linea(s)</Badge>
            </div>
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>Precio</th>
                  <th>Subtotal</th>
                  <th>Margen</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <LineRow key={line.id} line={line} costVisible={order.costVisible} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-panel">
            <div className="admin-panel__h">
              <h3>Totales</h3>
            </div>
            <Totals order={order} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-panel">
            <div className="sc-lbl">Cliente</div>
            <div className="admin-detail-kv">
              <span>ID</span>
              <Link href={`/clientes/${order.customerId}`} style={{ color: "var(--admin-accent)", fontWeight: 650 }}>
                Ver cliente
              </Link>
            </div>
            <div className="admin-detail-kv">
              <span>Cliente</span>
              <b className="admin-mono" style={{ fontSize: 12 }}>{order.customerId}</b>
            </div>
          </div>

          <div className="admin-panel">
            <div className="admin-panel__h">
              <h3>Envio</h3>
              {shipment ? (
                <Button variant="secondary" size="sm" loading={refreshTracking.isPending} onClick={() => refreshTracking.mutate("id" in shipment ? shipment.id : shipment.shipmentId)}>
                  <RefreshCw size={15} /> Tracking
                </Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setShippingDialog(true)}>
                  <Truck size={15} /> Crear envio
                </Button>
              )}
            </div>
            {shipment ? (
              <ShipmentPanel shipment={shipment} />
            ) : (
              <div className="admin-cell-sub">
                No hay envio cargado en esta sesion. Si ya existia uno, el backend todavia no expone una consulta por orden.
              </div>
            )}
          </div>

          <div className="admin-panel">
            <div className="sc-lbl">Historial</div>
            {order.statusHistory.length === 0 ? (
              <div className="admin-cell-sub">Sin eventos registrados.</div>
            ) : (
              order.statusHistory.map((event, index) => (
                <div className="admin-activity__row" key={`${event.toStatus}-${index}`}>
                  <StatusBadge status={event.toStatus} />
                  <div>
                    <div className="admin-cell-str">{formatDate(event.createdAt)}</div>
                    <div className="admin-cell-sub">{event.reason ?? "Sin motivo"}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={transitionTarget !== null} onOpenChange={(open) => !open && setTransitionTarget(null)}>
        <DialogContent
          title="Cambiar estado"
          description={transitionTarget?.label}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                variant="primary"
                loading={transition.isPending}
                disabled={transitionTarget?.reasonRequired && reason.trim().length === 0}
                onClick={() => transitionTarget && transition.mutate({ toStatus: transitionTarget.status, reason })}
              >
                Confirmar
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <label className="admin-form-g">
              <span>Estado</span>
              <Select
                value={transitionTarget?.status ?? otherStatus}
                onChange={(event) => {
                  const next = event.target.value as OrderStatus;
                  setOtherStatus(next);
                  setTransitionTarget({ status: next, label: "Otro estado", reasonRequired: needsReason(next) });
                }}
                options={ALL_STATUSES.map((status) => ({ value: status, label: status }))}
              />
            </label>
            {transitionTarget?.reasonRequired && (
              <label className="admin-form-g">
                <span>Motivo</span>
                <textarea className="ui-input" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={canceling} onOpenChange={(open) => !open && setCanceling(false)}>
        <DialogContent
          tone="danger"
          title="Cancelar pedido"
          description="El motivo es obligatorio y queda auditado."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Volver</Button>
              </DialogClose>
              <Button variant="danger" loading={cancel.isPending} disabled={reason.trim().length === 0} onClick={() => cancel.mutate()}>
                Cancelar pedido
              </Button>
            </>
          }
        >
          <label className="admin-form-g">
            <span>Motivo</span>
            <textarea className="ui-input" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
        </DialogContent>
      </Dialog>

      <Dialog open={shippingDialog} onOpenChange={(open) => !open && setShippingDialog(false)}>
        <DialogContent
          title="Crear envio"
          description="Se guarda localmente para refrescar tracking en esta sesion."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="primary" loading={createShipment.isPending} onClick={() => createShipment.mutate()}>
                Crear envio
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <label className="admin-form-g">
              <span>Transportista</span>
              <input className="ui-input" value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder="Opcional" />
            </label>
            <label className="admin-form-g">
              <span>Tracking</span>
              <input className="ui-input admin-mono" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} placeholder="Opcional" />
            </label>
            <label className="admin-form-g">
              <span>ETA</span>
              <input className="ui-input admin-mono" type="date" value={eta} onChange={(event) => setEta(event.target.value)} />
            </label>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LineRow({ line, costVisible }: { line: OrderLineView; costVisible: boolean }) {
  return (
    <tr>
      <td>
        <span className="admin-cell-str">{line.productTitle}</span>
        <span className="admin-cell-sub admin-mono">{line.sku ?? line.variantId}</span>
      </td>
      <td className="admin-mono">{line.quantity}</td>
      <td className="admin-mono">{money(line.unitPrice)}</td>
      <td className="admin-mono">{money(line.lineTotal)}</td>
      <td>
        {!costVisible ? (
          <span className="admin-cell-sub">No disponible para tu rol</span>
        ) : line.costUnknown ? (
          <Badge tone="warning">Costo desconocido</Badge>
        ) : (
          <span className="admin-mono">{money(line.lineMargin)}</span>
        )}
      </td>
    </tr>
  );
}

function Totals({ order }: { order: OrderDetail }) {
  return (
    <div>
      <div className="admin-detail-kv"><span>Subtotal</span><b className="admin-mono">{money(order.subtotal)}</b></div>
      <div className="admin-detail-kv"><span>Descuento</span><b className="admin-mono">{money(order.discount)}</b></div>
      <div className="admin-detail-kv"><span>Envio</span><b className="admin-mono">{money(order.shipping)}</b></div>
      <div className="admin-detail-kv"><span>Impuestos</span><b className="admin-mono">{money(order.tax)}</b></div>
      <div className="admin-detail-kv"><span>Total</span><b className="admin-mono">{money(order.total)}</b></div>
      <div className="admin-detail-kv">
        <span>Margen</span>
        {order.costVisible ? <b className="admin-mono">{money(order.totalMargin)}</b> : <b className="admin-cell-sub">No disponible para tu rol</b>}
      </div>
    </div>
  );
}

function ShipmentPanel({ shipment }: { shipment: ShipmentView | TrackingView }) {
  return (
    <div>
      <div className="admin-detail-kv"><span>Estado</span><StatusBadge status={shipment.status} /></div>
      <div className="admin-detail-kv"><span>Carrier</span><b>{shipment.carrier ?? "-"}</b></div>
      <div className="admin-detail-kv"><span>Tracking</span><b className="admin-mono">{shipment.trackingCode ?? "-"}</b></div>
      <div className="admin-detail-kv"><span>ETA</span><b>{shipment.eta ? formatDate(shipment.eta) : "-"}</b></div>
      {"stale" in shipment && shipment.stale && <div className="admin-info-strip" style={{ marginTop: 12 }}>Tracking servido desde ultimo estado conocido.</div>}
      <div style={{ marginTop: 12 }}>
        {shipment.events.length === 0 ? (
          <div className="admin-cell-sub">Sin eventos de tracking.</div>
        ) : (
          shipment.events.map((event, index) => (
            <div className="admin-activity__row" key={`${event.status}-${index}`}>
              <StatusBadge status={event.status} />
              <div>
                <div className="admin-cell-str">{formatDate(event.occurredAt)}</div>
                <div className="admin-cell-sub">{event.description ?? "Sin detalle"}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
