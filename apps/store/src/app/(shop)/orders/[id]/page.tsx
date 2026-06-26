import { notFound } from "next/navigation";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { OrderDetail } from "@/components/account/order-detail";
import { getOrderById } from "@/lib/mock-account";
import type { Metadata } from "next";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const order = getOrderById(id);
  return {
    title: order ? `Pedido #${order.id} | cloudcommerce` : "Pedido no encontrado",
    robots: { index: false, follow: false },
  };
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = getOrderById(id);
  if (!order) notFound();
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 flex gap-8 items-start">
      <AccountSidebar activePath="/orders" />
      <main className="min-w-0 flex-1">
        <OrderDetail order={order} />
      </main>
    </div>
  );
}
