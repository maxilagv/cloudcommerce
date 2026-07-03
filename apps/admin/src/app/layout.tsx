import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@cloudcommerce/ui/styles.css";
import "./app.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-admin", display: "swap" });

export const metadata: Metadata = {
  title: "CloudCommerce — Panel de administración",
  description: "Gestioná tu tienda: productos, pedidos, clientes, finanzas e IA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
