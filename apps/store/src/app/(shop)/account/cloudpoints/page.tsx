import type { Metadata } from "next";
import { CloudPointsView } from "@/components/account/cloudpoints-view";

export const metadata: Metadata = {
  title: "CloudPoints | CloudCommerce",
  robots: { index: false, follow: false },
};

export default function CloudPointsPage() {
  return <CloudPointsView />;
}
