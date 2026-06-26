import { AccountSidebar } from "@/components/account/account-sidebar";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1440px] px-4 py-8 flex gap-8 items-start">
      <AccountSidebar activePath="/account" />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
