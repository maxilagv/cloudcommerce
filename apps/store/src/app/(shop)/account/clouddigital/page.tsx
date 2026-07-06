import type { Metadata } from "next";
import { CloudDigitalView } from "@/components/account/clouddigital-view";

export const metadata: Metadata = {
  title: "CloudDigital | CloudCommerce",
  robots: { index: false, follow: false },
};

export default function CloudDigitalPage() {
  return <CloudDigitalView />;
}
