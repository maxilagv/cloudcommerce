import Image from "next/image";
import Link from "next/link";
import { formatCOP } from "@/lib/utils";
import { mockProducts } from "@/lib/mock-products";

export function AiMiniCard({ productId }: { productId: string }) {
  const product = mockProducts.find((p) => p.id === productId);
  if (!product) return null;

  return (
    <Link
      href={`/products/${productId}`}
      className="flex items-center gap-2.5 p-2.5 rounded-cc-lg border border-cc-border-subtle bg-cc-shell hover:border-cc-primary-border hover:shadow-cc-sm transition-all duration-[160ms] ease-cc-out min-w-[200px] max-w-[220px]"
    >
      <div className="h-12 w-12 shrink-0 rounded-cc-xs bg-cc-bg-surface-soft flex items-center justify-center overflow-hidden">
        <Image
          src={product.image}
          alt={product.name}
          width={44}
          height={44}
          className="object-contain"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-cc-text cc-line-clamp-2 leading-snug">
          {product.brand} {product.name}
        </p>
        <p className="text-[12px] font-black text-cc-primary mt-0.5">
          {formatCOP(product.price)}
        </p>
      </div>
    </Link>
  );
}
