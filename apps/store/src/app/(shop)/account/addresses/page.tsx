import type { Metadata } from "next";
import { SavedAddresses } from "@/components/account/saved-addresses";
import { PaymentMethods } from "@/components/account/payment-methods";

export const metadata: Metadata = {
  title: "Mis direcciones | cloudcommerce",
  robots: { index: false, follow: false },
};

export default function AddressesPage() {
  return (
    <div className="flex flex-col gap-8">
      <SavedAddresses />
      <PaymentMethods />
    </div>
  );
}
