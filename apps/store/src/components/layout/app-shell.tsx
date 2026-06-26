import { TopHeader } from "./navbar";
import { TrustBar } from "./trust-bar";
import { FloatingAssistantButton } from "./floating-assistant";
import { CartDrawer } from "@/components/cart/drawer";
import { WishlistDrawer } from "./wishlist-drawer";

/** Page shell: header + content slot + trust bar + floating assistant + drawers. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cc-page">
      <TopHeader />
      <main className="flex-1">{children}</main>
      <TrustBar />
      <FloatingAssistantButton />
      <CartDrawer />
      <WishlistDrawer />
    </div>
  );
}
