import { TopHeader } from "./navbar";
import { TrustBar } from "./trust-bar";
import { SiteFooter } from "./footer";
import { FloatingAssistantButton } from "./floating-assistant";
import { CartDrawer } from "@/components/cart/drawer";
import { WishlistDrawer } from "./wishlist-drawer";
import { CompareBar } from "@/components/compare/compare-bar";

/** Page shell: header + content slot + trust bar + footer + drawers. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cc-page">
      <TopHeader />
      <main className="flex-1">{children}</main>
      <TrustBar />
      <SiteFooter />
      <FloatingAssistantButton />
      <CartDrawer />
      <WishlistDrawer />
      <CompareBar />
    </div>
  );
}
