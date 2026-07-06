import { Headphones, RotateCcw, ShieldCheck, Truck } from "lucide-react";

const ITEMS = [
  { icon: Truck, title: "Envíos a todo el país", sub: "Con seguimiento en línea" },
  { icon: ShieldCheck, title: "Pago 100% seguro", sub: "Compra protegida" },
  { icon: RotateCcw, title: "Devoluciones fáciles", sub: "Hasta 30 días" },
  { icon: Headphones, title: "Atención personalizada", sub: "Soporte siempre activo" },
];

export function TrustBar() {
  return (
    <div className="border-t border-cc-border bg-cc-shell">
      <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-4 px-4 py-6 sm:px-6 lg:grid-cols-4">
        {ITEMS.map(({ icon: Icon, title, sub }) => (
          <div key={title} className="group flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-cc-md bg-cc-soft text-cc-secondary transition-[transform,background,color] duration-[180ms] ease-cc-out group-hover:-translate-y-px group-hover:bg-cc-primary-soft group-hover:text-cc-primary">
              <Icon className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-cc-text">
                {title}
              </p>
              <p className="truncate text-xs text-cc-muted">{sub}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
