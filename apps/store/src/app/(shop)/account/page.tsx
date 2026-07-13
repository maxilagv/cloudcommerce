import type { Metadata } from "next";
import { WelcomeSummary } from "@/components/account/welcome-summary";
import { MetricCards } from "@/components/account/metric-cards";
import { SpendingChart } from "@/components/account/spending-chart";
import { StatusDonut } from "@/components/account/status-donut";
import { OrderStatusList } from "@/components/account/order-status-list";
import { RecentPurchases } from "@/components/account/recent-purchases";
import { DocumentsTable } from "@/components/account/documents-table";

export const metadata: Metadata = {
  title: "Mi cuenta | CloudCommerce",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <div className="flex flex-col gap-6">
      <WelcomeSummary />
      <MetricCards />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SpendingChart />
        <StatusDonut />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrderStatusList />
        <RecentPurchases />
      </div>
      <DocumentsTable />
    </div>
  );
}
