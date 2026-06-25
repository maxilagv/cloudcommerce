import { TopHeader } from "./navbar";
import { TrustBar } from "./trust-bar";
import { FloatingAssistantButton } from "./floating-assistant";

/** Page shell: header + content slot + trust bar + floating assistant. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cc-page">
      <TopHeader />
      <main className="flex-1">{children}</main>
      <TrustBar />
      <FloatingAssistantButton />
    </div>
  );
}
