import { NotFoundContent } from "@/components/ui/not-found-content";

/** notFound() calls inside (shop) routes (e.g. an invalid product slug) land here,
 *  inheriting AppShell's header/footer from (shop)/layout.tsx. */
export default function ShopNotFound() {
  return <NotFoundContent />;
}
