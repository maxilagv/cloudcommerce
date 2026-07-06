import { AccountSidebar } from "@/components/account/account-sidebar";
import { OrderDetailResolver } from "@/components/account/order-detail-resolver";
import { AuthGuard } from "@/components/account/auth-guard";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

// The order itself is fetched client-side (session cookie); metadata stays static.
export const metadata: Metadata = {
  title: "Detalle del pedido | cloudcommerce",
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <AuthGuard>
      <div className="mx-auto flex max-w-[1440px] items-start gap-8 px-4 py-8">
        <AccountSidebar activePath="/orders" />
        <main className="min-w-0 flex-1">
          <OrderDetailResolver id={id} />
        </main>
      </div>
    </AuthGuard>
  );
}
