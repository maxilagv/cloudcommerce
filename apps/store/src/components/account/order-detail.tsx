import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, Truck, Clock, CheckCircle2, XCircle, Package, MapPin, CreditCard } from "lucide-react";
import { formatCOP } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/mock-account";

const statusConfig: Record<
  OrderStatus,
  { label: string; bg: string; text: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }
> = {
  "in-transit": { label: "En tránsito", bg: "bg-[#EAF3FF]", text: "text-cc-primary", Icon: Truck },
  preparing: { label: "Preparando", bg: "bg-[#FFF7E6]", text: "text-[#B45309]", Icon: Clock },
  delivered: { label: "Entregado", bg: "bg-cc-success-soft", text: "text-cc-success", Icon: CheckCircle2 },
  cancelled: { label: "Cancelado", bg: "bg-cc-border-subtle", text: "text-cc-muted", Icon: XCircle },
};

const TIMELINE_STEPS = [
  { label: "Pedido confirmado", statuses: ["preparing", "in-transit", "delivered"] as OrderStatus[] },
  { label: "Preparando envío", statuses: ["in-transit", "delivered"] as OrderStatus[] },
  { label: "En camino", statuses: ["in-transit", "delivered"] as OrderStatus[] },
  { label: "Entregado", statuses: ["delivered"] as OrderStatus[] },
];

export function OrderDetail({ order }: { order: Order }) {
  const cfg = statusConfig[order.status];
  const { Icon } = cfg;

  return (
    <div className="flex flex-col gap-6">
      {/* Back + header */}
      <div>
        <Link
          href="/orders"
          className="inline-flex items-center gap-1 text-[13px] text-cc-muted hover:text-cc-primary transition-colors duration-[140ms] mb-3"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
          Volver a mis pedidos
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[22px] font-bold text-cc-text">
            Pedido #{order.id}
          </h1>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-semibold ${cfg.bg} ${cfg.text}`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.8} />
            {cfg.label}
          </span>
        </div>
        <p className="text-[13px] text-cc-muted mt-1">
          Realizado el {order.date}
          {order.eta && ` · Entrega estimada: ${order.eta}`}
        </p>
      </div>

      {/* Timeline (only for non-cancelled) */}
      {order.status !== "cancelled" && (
        <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-5">
          <h2 className="text-[14px] font-bold text-cc-text mb-4">Seguimiento</h2>
          <div className="relative flex flex-col gap-0">
            {TIMELINE_STEPS.map((step, i) => {
              const done = step.statuses.includes(order.status);
              const isLast = i === TIMELINE_STEPS.length - 1;
              return (
                <div key={step.label} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <div
                      className={[
                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 z-10",
                        done ? "bg-cc-primary" : "bg-cc-border-subtle",
                      ].join(" ")}
                    >
                      <Package
                        className={`h-3.5 w-3.5 ${done ? "text-white" : "text-cc-faint"}`}
                        strokeWidth={2}
                      />
                    </div>
                    {!isLast && (
                      <div
                        className={`w-0.5 h-8 ${done ? "bg-cc-primary" : "bg-cc-border-subtle"}`}
                      />
                    )}
                  </div>
                  <p
                    className={[
                      "text-[13px] pt-1 font-medium",
                      done ? "text-cc-text" : "text-cc-faint",
                    ].join(" ")}
                  >
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Products */}
      <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-5">
        <h2 className="text-[14px] font-bold text-cc-text mb-4">Productos</h2>
        <ul className="flex flex-col divide-y divide-cc-border-subtle">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
              <div className="h-16 w-16 shrink-0 rounded-cc-xs bg-cc-bg-surface-soft flex items-center justify-center overflow-hidden">
                <Image
                  src={item.image}
                  alt={item.name}
                  width={56}
                  height={56}
                  className="object-contain"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-cc-text leading-snug">
                  {item.name}
                </p>
                <p className="text-[13px] text-cc-muted mt-0.5">
                  Cantidad: {item.qty}
                </p>
              </div>
              <p className="text-[14px] font-bold text-cc-text shrink-0">
                {formatCOP(item.price * item.qty)}
              </p>
            </li>
          ))}
        </ul>

        {/* Totals */}
        <div className="border-t border-cc-border-subtle mt-4 pt-4 flex flex-col gap-2">
          <div className="flex justify-between text-[13px] text-cc-secondary">
            <span>Subtotal</span>
            <span>{formatCOP(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-[13px] text-cc-success">
              <span>Descuento</span>
              <span>-{formatCOP(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-[13px] text-cc-secondary">
            <span>Envío</span>
            <span className={order.shipping === 0 ? "text-cc-success font-medium" : ""}>
              {order.shipping === 0 ? "Gratis" : formatCOP(order.shipping)}
            </span>
          </div>
          <div className="flex justify-between text-[16px] font-black text-cc-text border-t border-cc-border-subtle pt-2 mt-1">
            <span>Total</span>
            <span>{formatCOP(order.total)}</span>
          </div>
        </div>
      </div>

      {/* Delivery + payment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-cc-primary" strokeWidth={1.8} />
            <h3 className="text-[13px] font-bold text-cc-text">Dirección de entrega</h3>
          </div>
          <p className="text-[13px] text-cc-secondary">{order.address}</p>
        </div>
        <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-cc-primary" strokeWidth={1.8} />
            <h3 className="text-[13px] font-bold text-cc-text">Método de pago</h3>
          </div>
          <p className="text-[13px] text-cc-secondary">
            Tarjeta terminada en {order.paymentLast4}
          </p>
        </div>
      </div>
    </div>
  );
}
