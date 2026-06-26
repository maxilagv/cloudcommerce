import { BrandLogo } from "./brand-logo";
import { MainNav } from "./main-nav";
import { SearchCommand } from "./search-command";
import { LocationSelector } from "./location-selector";
import { HeaderActions } from "./header-actions";

/** TopHeader — sticky white shell with logo, nav, search, location, actions. */
export function TopHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-cc-border bg-cc-shell/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <BrandLogo />
        <MainNav />
        <SearchCommand />
        <LocationSelector />
        <HeaderActions />
      </div>
    </header>
  );
}
