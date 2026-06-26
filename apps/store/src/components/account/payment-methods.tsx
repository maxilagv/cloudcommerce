import { CreditCard, Plus, Trash2 } from "lucide-react";
import { mockPaymentMethods } from "@/lib/mock-account";

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

export function PaymentMethods() {
  return (
    <div>
      <h2 className="text-[18px] font-bold text-cc-text mb-4">
        Métodos de pago
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {mockPaymentMethods.map((pm) => (
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
              <p className="text-[12px] text-cc-muted mt-0.5">
                Vence {pm.expiry}
              </p>
            </div>
            <button
              type="button"
              className="h-7 w-7 rounded-cc-sm flex items-center justify-center text-cc-muted hover:text-cc-danger hover:bg-cc-danger-soft transition-colors duration-[140ms] cc-focus-ring"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </div>
        ))}

        {/* Add new */}
        <button
          type="button"
          className="flex items-center justify-center gap-2 h-[72px] rounded-cc-xl border-2 border-dashed border-cc-border-strong text-cc-muted hover:border-cc-primary hover:text-cc-primary hover:bg-cc-primary-soft transition-colors duration-[140ms] ease-cc-out cc-focus-ring"
        >
          <Plus className="h-4 w-4" strokeWidth={1.8} />
          <span className="text-[13px] font-medium">Agregar método de pago</span>
        </button>
      </div>
    </div>
  );
}
