import type { ReactNode } from "react";
import { AuthGate } from "@/components/shell/auth-gate";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
