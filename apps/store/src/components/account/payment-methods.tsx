"use client";

import { useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { usePayments } from "@/store/payments";
import { toast } from "@/store/toast";
import { Modal } from "@/components/ui/modal";
import type { PaymentMethod } from "@/lib/account-types";

const cardColors: Record<string, string> = {
  visa: "bg-[#1A1F71]",
  mastercard: "bg-[#EB001B]",
  amex: "bg-[#007BC1]",
};

const cardLabels: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
};

function detectType(number: string): PaymentMethod["type"] {
  const n = number.replace(/\D/g, "");
  if (n.startsWith("4")) return "visa";
  if (n.startsWith("34") || n.startsWith("37")) return "amex";
  return "mastercard";
}

export function PaymentMethods() {
  const methods = usePayments((s) => s.methods);
  const add = usePayments((s) => s.add);
  const remove = usePayments((s) => s.remove);

  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");

  function save() {
    const digits = number.replace(/\D/g, "");
    if (digits.length < 15) {
      toast.error("Número de tarjeta inválido");
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      toast.error("Vencimiento inválido (MM/AA)");
      return;
    }
    add({ type: detectType(number), last4: digits.slice(-4), expiry });
    toast.success("Método de pago agregado");
    setNumber("");
    setExpiry("");
    setOpen(false);
  }

  return (
    <div>
      <h2 className="text-[18px] font-bold text-cc-text mb-4">Métodos de pago</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {methods.map((pm) => (
          <div
            key={pm.id}
            className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-4 flex items-center gap-4"
          >
            <div
              className={`h-10 w-14 rounded-cc-sm ${cardColors[pm.type]} flex items-center justify-center`}
            >
              <CreditCard className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-cc-text">
                {cardLabels[pm.type]} •••• {pm.last4}
              </p>
              <p className="text-[12px] text-cc-muted mt-0.5">Vence {pm.expiry}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                remove(pm.id);
                toast.info("Método de pago eliminado");
              }}
              aria-label={`Eliminar tarjeta terminada en ${pm.last4}`}
              className="h-7 w-7 rounded-cc-sm flex items-center justify-center text-cc-muted hover:text-cc-danger hover:bg-cc-danger-soft transition-colors duration-[140ms] cc-focus-ring"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-2 h-[72px] rounded-cc-xl border-2 border-dashed border-cc-border-strong text-cc-muted hover:border-cc-primary hover:text-cc-primary hover:bg-cc-primary-soft transition-colors duration-[140ms] ease-cc-out cc-focus-ring"
        >
          <Plus className="h-4 w-4" strokeWidth={1.8} />
          <span className="text-[13px] font-medium">Agregar método de pago</span>
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Agregar tarjeta"
        footer={
          <>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-cc-sm px-4 py-2 text-[13px] font-medium text-cc-secondary hover:bg-cc-soft"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-cc-sm bg-cc-primary px-5 py-2 text-[13px] font-semibold text-white hover:bg-cc-primary-hover"
            >
              Guardar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-cc-secondary">Número de tarjeta</span>
            <input
              type="text"
              inputMode="numeric"
              value={number}
              onChange={(e) =>
                setNumber(
                  e.target.value
                    .replace(/\D/g, "")
                    .slice(0, 16)
                    .replace(/(.{4})/g, "$1 ")
                    .trim(),
                )
              }
              placeholder="0000 0000 0000 0000"
              className="h-11 rounded-cc-sm border border-cc-border bg-white px-3 text-[14px] tracking-wider text-cc-text outline-none transition-[border-color,box-shadow] duration-[140ms] placeholder:text-cc-faint focus:border-cc-primary focus:ring-2 focus:ring-cc-primary/10"
            />
          </label>
          <label className="flex w-32 flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-cc-secondary">Vencimiento</span>
            <input
              type="text"
              inputMode="numeric"
              value={expiry}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "").slice(0, 4);
                setExpiry(d.length >= 3 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
              }}
              placeholder="MM/AA"
              maxLength={5}
              className="h-11 rounded-cc-sm border border-cc-border bg-white px-3 text-[14px] text-cc-text outline-none transition-[border-color,box-shadow] duration-[140ms] placeholder:text-cc-faint focus:border-cc-primary focus:ring-2 focus:ring-cc-primary/10"
            />
          </label>
          <p className="text-[12px] text-cc-muted">
            Datos simulados — no se almacena información real de tarjetas.
          </p>
        </div>
      </Modal>
    </div>
  );
}
