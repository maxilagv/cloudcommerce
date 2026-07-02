import Image from "next/image";
import Link from "next/link";
import { formatCOP } from "@/lib/utils";
import { mockOrders } from "@/lib/mock-account";

export function RecentPurchases() {
  const delivered = mockOrders
    .filter((o) => o.status === "delivered")
    .flatMap((o) =>
      o.items.map((item) => ({ ...item, date: o.date, orderId: o.id }))
    )
    .slice(0, 4);

  return (
    <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm p-5">
      <h2 className="text-[15px] font-bold text-cc-text mb-4">Últimas compras</h2>
      <ul className="flex flex-col divide-y divide-cc-border-subtle">
        {delivered.map((item, i) => (
          <li key={i}>
            <Link
              href={`/orders/${item.orderId}`}
              className="flex items-center gap-3 py-3 hover:bg-cc-bg-hover rounded-cc-sm px-2 -mx-2 transition-colors duration-[140ms] ease-cc-out"
            >
              <div className="h-12 w-12 shrink-0 rounded-cc-xs bg-cc-bg-surface-soft flex items-center justify-center overflow-hidden">
                <Image
                  src={item.image}
                  alt={item.name}
                  width={44}
                  height={44}
                  className="object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-cc-text leading-snug cc-line-clamp-2">
                  {item.name}
                </p>
                <p className="text-[11px] text-cc-muted mt-0.5">{item.date}</p>
              </div>
              <p className="text-[13px] font-bold text-cc-text shrink-0">
                {formatCOP(item.price)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
