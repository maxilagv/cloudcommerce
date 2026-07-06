import { getStoreCategories } from "@/lib/api/catalog";
import type { CategoryLink } from "@/lib/catalog-types";
import { BrandLogo } from "./brand-logo";
import { MainNav } from "./main-nav";
import { MobileMenu } from "./mobile-menu";
import { SearchCommand } from "./search-command";
import { LocationSelector } from "./location-selector";
import { HeaderActions } from "./header-actions";

/** TopHeader — sticky white shell with menu, logo, nav, search, location, actions. */
export async function TopHeader() {
  const categories: CategoryLink[] = (await getStoreCategories())
    .filter((c) => c.isActive)
    .map((c) => ({ label: c.name, slug: c.slug }));

  return (
    <header className="sticky top-0 z-50 border-b border-cc-border bg-cc-shell/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <MobileMenu categories={categories} />
        <BrandLogo />
        <MainNav />
        <SearchCommand />
        <LocationSelector />
        <HeaderActions />
      </div>
    </header>
  );
}
