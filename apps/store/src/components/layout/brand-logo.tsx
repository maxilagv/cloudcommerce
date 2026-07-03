import Link from "next/link";
import { Cloud } from "lucide-react";

export function BrandLogo() {
  return (
    <Link
      href="/"
      className="cc-focus-ring flex shrink-0 items-center gap-2 rounded-cc-sm"
      aria-label="CloudCommerce inicio"
    >
      <span className="grid h-8 w-8 place-items-center rounded-cc-sm bg-cc-primary-soft text-cc-primary">
        <Cloud className="h-[18px] w-[18px]" strokeWidth={2.2} fill="currentColor" />
      </span>
      <span className="text-[17px] font-bold tracking-[-0.02em] text-cc-text">
        cloud<span className="text-cc-primary">commerce</span>
      </span>
    </Link>
  );
}
