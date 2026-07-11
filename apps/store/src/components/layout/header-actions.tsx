"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Heart, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/hooks/use-hydrated";
import { spring } from "@/lib/motion";
import { useCart, useCartCount } from "@/store/cart";
import { useWishlist, useWishlistCount } from "@/store/wishlist";
import { useAuth } from "@/store/auth";

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  const display = count > 99 ? "99+" : String(count);
  return (
    <span
      className={cn(
        "absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center overflow-hidden rounded-full bg-cc-primary px-1 text-[10px] font-bold text-white",
        "animate-[cc-badge-pop_300ms_ease-cc-spring]",
      )}
    >
      {/* Digit rollover: old value slides up-out while the new one slides up-in. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={display}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={spring.snappy}
          className="col-start-1 row-start-1"
        >
          {display}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const actionClass =
  "cc-focus-ring relative grid h-10 w-10 place-items-center rounded-cc-sm text-cc-secondary transition-[color,background] duration-[140ms] ease-cc-out hover:bg-cc-primary-softer hover:text-cc-primary";

export function HeaderActions() {
  const hydrated = useHydrated();
  const cartCount = useCartCount();
  const wishlistCount = useWishlistCount();
  const openCart = useCart((s) => s.open);
  const openWishlist = useWishlist((s) => s.open);
  const user = useAuth((s) => s.user);
  const hydrateSession = useAuth((s) => s.hydrateSession);

  // Recover the cookie session once per page load (deduped inside the store)
  // only when a previous session exists locally, so anonymous visitors don't
  // fire an UNAUTHORIZED request on every page.
  useEffect(() => {
    if (useAuth.getState().user) void hydrateSession();
  }, [hydrateSession]);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Link href="/account" aria-label="Mi cuenta" className={actionClass}>
        {hydrated && user ? (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-cc-primary text-[11px] font-bold text-white">
            {user.initials}
          </span>
        ) : (
          <User className="h-[22px] w-[22px]" strokeWidth={1.85} />
        )}
      </Link>

      <button
        type="button"
        aria-label="Favoritos"
        onClick={openWishlist}
        className={actionClass}
      >
        <Heart className="h-[22px] w-[22px]" strokeWidth={1.85} />
        <Badge count={hydrated ? wishlistCount : 0} />
      </button>

      <button
        type="button"
        id="cc-cart-icon-target"
        aria-label="Carrito"
        onClick={openCart}
        className={actionClass}
      >
        <ShoppingCart className="h-[22px] w-[22px]" strokeWidth={1.85} />
        <Badge count={hydrated ? cartCount : 0} />
      </button>
    </div>
  );
}
