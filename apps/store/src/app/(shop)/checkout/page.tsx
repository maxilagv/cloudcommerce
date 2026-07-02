"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Check, Loader2, Lock } from "lucide-react";
import { cn, formatCOP } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";
import { useAuth } from "@/store/auth";
import { useCart, useCartTotal } from "@/store/cart";
import { useOrders } from "@/store/orders";
import { toast } from "@/store/toast";
import { SHIPPING_OPTIONS, DEFAULT_SHIPPING_ID } from "@/lib/constants";
import type { Order } from "@/lib/mock-account";
import {
  AddressForm,
  emptyAddress,
  validateAddress,
  type AddressData,
  type AddressErrors,
} from "@/components/checkout/address-form";
import { ShippingOptions } from "@/components/checkout/shipping-options";
import {
  PaymentForm,
  emptyPayment,
  validatePayment,
  type PaymentData,
  type PaymentErrors,
} from "@/components/checkout/payment-form";

const STEPS = ["Dirección", "Envío", "Pago", "Confirmar"];

function formatDate(d: Date) {
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

export default function CheckoutPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);
  const subtotal = useCartTotal();
  const addOrder = useOrders((s) => s.addOrder);

  const [step, setStep] = useState(0);
  const [address, setAddress] = useState<AddressData>(emptyAddress);
  const [addressErrors, setAddressErrors] = useState<AddressErrors>({});
  const [shippingId, setShippingId] = useState(DEFAULT_SHIPPING_ID);
  const [payment, setPayment] = useState<PaymentData>(emptyPayment);
  const [paymentErrors, setPaymentErrors] = useState<PaymentErrors>({});
  const [placing, setPlacing] = useState(false);

  // Prefill names once the user is known.
  useEffect(() => {
    if (user) {
      setAddress((a) => (a.name ? a : { ...a, name: user.name }));
      setPayment((p) => (p.holder ? p : { ...p, holder: user.name }));
    }
  }, [user]);

  // Gate: login required to buy, and cart must be non-empty.
  useEffect(() => {
    if (!hydrated || placing) return;
    if (!user) {
      router.replace("/login?returnTo=/checkout");
    } else if (items.length === 0) {
      router.replace("/cart");
    }
  }, [hydrated, user, items.length, placing, router]);

  const shipping = useMemo(
    () => SHIPPING_OPTIONS.find((o) => o.id === shippingId) ?? SHIPPING_OPTIONS[0],
    [shippingId],
  );
  const total = subtotal + shipping.cost;

  if (!hydrated || !user || items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[1100px] items-center justify-center px-4 py-24">
        <Loader2 className="h-6 w-6 animate-spin text-cc-muted" />
      </div>
    );
  }

  function next() {
    if (step === 0) {
      const errs = validateAddress(address);
      setAddressErrors(errs);
      if (Object.keys(errs).length > 0) return;
    }
    if (step === 2) {
      const errs = validatePayment(payment);
      setPaymentErrors(errs);
      if (Object.keys(errs).length > 0) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function placeOrder() {
    setPlacing(true);
    const order: Order = {
      id: `CC-${Date.now().toString().slice(-8)}`,
      status: "preparing",
      date: formatDate(new Date()),
      eta: formatDate(new Date(Date.now() + 5 * 86_400_000)),
      items: items.map((ci) => ({
        productId: ci.product.id,
        name: ci.product.name,
        image: ci.product.image,
        qty: ci.quantity,
        price: ci.product.price,
      })),
      subtotal,
      shipping: shipping.cost,
      discount: 0,
      total,
      address: `${address.street}, ${address.city}`,
      paymentLast4: payment.number.replace(/\D/g, "").slice(-4) || "0000",
    };

    // Simulate network/payment latency.
    window.setTimeout(() => {
      addOrder(order);
      clearCart();
      toast.success("¡Pedido confirmado!", { description: `#${order.id}` });
      router.replace("/checkout/success");
    }, 1200);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6">
      <h1 className="text-[22px] font-bold text-cc-text">Finalizar compra</h1>

      {/* Stepper */}
      <ol className="mt-5 flex items-center gap-2">
        {STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold transition-colors",
                    done && "bg-cc-success text-white",
                    current && "bg-cc-primary text-white",
                    !done && !current && "bg-cc-soft text-cc-muted",
                  )}
                >
                  {done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-[13px] font-medium sm:inline",
                    current ? "text-cc-text" : "text-cc-muted",
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span className={cn("h-px flex-1", done ? "bg-cc-success" : "bg-cc-border")} />
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Step content */}
        <div className="rounded-cc-lg border border-cc-border bg-white p-5 sm:p-6">
          {step === 0 && (
            <>
              <h2 className="mb-4 text-[16px] font-bold text-cc-text">Dirección de envío</h2>
              <AddressForm value={address} onChange={setAddress} errors={addressErrors} />
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="mb-4 text-[16px] font-bold text-cc-text">Método de envío</h2>
              <ShippingOptions value={shippingId} onChange={setShippingId} />
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="mb-4 text-[16px] font-bold text-cc-text">Pago</h2>
              <PaymentForm value={payment} onChange={setPayment} errors={paymentErrors} />
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="mb-4 text-[16px] font-bold text-cc-text">Revisá tu pedido</h2>
              <dl className="space-y-3 text-[13px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-cc-muted">Envío a</dt>
                  <dd className="text-right font-medium text-cc-text">
                    {address.name}
                    <br />
                    {address.street}, {address.city}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-cc-border-subtle pt-3">
                  <dt className="text-cc-muted">Método de envío</dt>
                  <dd className="font-medium text-cc-text">{shipping.label}</dd>
                </div>
                <div className="flex justify-between gap-4 border-t border-cc-border-subtle pt-3">
                  <dt className="text-cc-muted">Pago</dt>
                  <dd className="font-medium text-cc-text">
                    Tarjeta •••• {payment.number.replace(/\D/g, "").slice(-4) || "0000"}
                  </dd>
                </div>
              </dl>
            </>
          )}

          {/* Nav */}
          <div className="mt-6 flex items-center justify-between gap-3">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
                disabled={placing}
                className="flex items-center gap-1.5 text-[13px] font-medium text-cc-secondary hover:text-cc-text disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={2} />
                Volver
              </button>
            ) : (
              <span />
            )}

            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={next}
                className="rounded-[11px] bg-cc-primary px-6 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-cc-primary-hover"
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                onClick={placeOrder}
                disabled={placing}
                className="flex items-center gap-2 rounded-[11px] bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] px-6 py-2.5 text-[14px] font-bold text-white shadow-[0_10px_22px_rgba(11,107,255,0.24)] transition-[filter] hover:brightness-[1.03] disabled:opacity-70"
              >
                {placing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando…
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" strokeWidth={2} />
                    Confirmar pedido
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Order summary */}
        <aside className="h-fit rounded-cc-lg border border-cc-border bg-white p-5 lg:sticky lg:top-[84px]">
          <h2 className="text-[15px] font-bold text-cc-text">Tu pedido</h2>
          <div className="mt-4 space-y-3">
            {items.map((ci) => (
              <div key={ci.product.id} className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 rounded-cc-sm bg-cc-soft">
                  <Image
                    src={ci.product.image}
                    alt={ci.product.imageAlt}
                    width={44}
                    height={44}
                    className="absolute inset-0 m-auto h-10 w-10 object-contain"
                  />
                  <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-cc-text px-1 text-[10px] font-bold text-white">
                    {ci.quantity}
                  </span>
                </div>
                <p className="min-w-0 flex-1 truncate text-[12px] text-cc-text">{ci.product.name}</p>
                <p className="text-[12px] font-semibold text-cc-text">
                  {formatCOP(ci.product.price * ci.quantity)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-cc-border-subtle pt-4 text-[13px]">
            <div className="flex justify-between">
              <span className="text-cc-secondary">Subtotal</span>
              <span className="font-semibold text-cc-text">{formatCOP(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-cc-secondary">Envío</span>
              <span className="font-semibold text-cc-text">
                {shipping.cost === 0 ? "Gratis" : formatCOP(shipping.cost)}
              </span>
            </div>
            <div className="flex justify-between border-t border-cc-border-subtle pt-2 text-[15px]">
              <span className="font-bold text-cc-text">Total</span>
              <span className="font-extrabold tracking-tight text-cc-text">{formatCOP(total)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
