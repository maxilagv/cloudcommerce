import type { Metadata } from "next";
import { OrdersList } from "@/components/account/orders-list";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { AuthGuard } from "@/components/account/auth-guard";

export const metadata: Metadata = {
  title: "Mis pedidos | cloudcommerce",
  robots: { index: false, follow: false },
};

export default function OrdersPage() {
  return (
    <AuthGuard>
      <div className="mx-auto max-w-[1440px] px-4 py-8 flex gap-8 items-start">
        <AccountSidebar activePath="/orders" />
        <main className="min-w-0 flex-1">
          <h1 className="text-[22px] font-bold text-cc-text mb-6">Mis pedidos</h1>
          <OrdersList />
        </main>
      </div>
    </AuthGuard>
  );
}
