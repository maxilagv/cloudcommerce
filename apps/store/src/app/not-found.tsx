import { BrandLogo } from "@/components/layout/brand-logo";
import { NotFoundContent } from "@/components/ui/not-found-content";

/** Root fallback for completely unmatched URLs — renders outside (shop)/layout.tsx,
 *  so it needs its own minimal header instead of inheriting AppShell. */
export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-cc-page">
      <header className="border-b border-cc-border bg-cc-shell/95 px-4 py-4 sm:px-6">
        <div className="mx-auto max-w-[1440px]">
          <BrandLogo />
        </div>
      </header>
      <main className="flex-1">
        <NotFoundContent />
      </main>
    </div>
  );
}
