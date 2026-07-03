"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Boxes, ClipboardList, Package, Sparkles } from "lucide-react";
import { Skeleton } from "@cloudcommerce/ui";
import { trpc } from "@/lib/trpc";

const QUICK_LINKS = [
  { href: "/productos", label: "Cargar producto", icon: Package, desc: "ABM de catálogo" },
  { href: "/pedidos", label: "Ver pedidos", icon: ClipboardList, desc: "Ciclo de venta" },
  { href: "/inventario", label: "Revisar stock", icon: Boxes, desc: "Niveles y alertas" },
  { href: "/ia", label: "Generar con IA", icon: Sparkles, desc: "Descripciones y SEO" },
];

const KPI_LABELS = ["Ventas del período", "Margen", "Pedidos", "Clientes nuevos"];

export default function DashboardPage() {
  const { data: me } = useQuery({
    queryKey: ["identity", "me"],
    queryFn: () => trpc.identity.me.query(),
    retry: false,
  });

  const firstName = me?.profile.fullName.split(" ")[0] ?? "";

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Hola{firstName ? `, ${firstName}` : ""} 👋</h1>
          <div className="admin-ph__sub">Este es el pulso de tu tienda. Las métricas en vivo llegan en la Fase 2.</div>
        </div>
      </div>

      {/* KPI placeholders — el dashboard con datos reales es la Fase 2 (dashboard.getOverview) */}
      <div className="admin-grid admin-grid--kpi">
        {KPI_LABELS.map((label) => (
          <div className="admin-kpi" key={label}>
            <div className="admin-kpi__h">
              <span className="admin-kpi__lbl">{label}</span>
            </div>
            <div style={{ marginTop: 14 }}>
              <Skeleton height={24} width="60%" />
            </div>
            <div style={{ marginTop: 10 }}>
              <Skeleton height={11} width="40%" />
            </div>
          </div>
        ))}
      </div>

      <div className="admin-grid admin-grid--2" style={{ marginTop: 16 }}>
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Accesos rápidos</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {QUICK_LINKS.map(({ href, label, icon: Icon, desc }) => (
              <Link
                key={href}
                href={href}
                className="admin-panel"
                style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}
              >
                <span className="admin-kpi__ic">
                  <Icon size={17} />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: "block", fontWeight: 600, fontSize: 13.5 }}>{label}</span>
                  <span style={{ display: "block", fontSize: 11.5, color: "var(--admin-text-muted)" }}>{desc}</span>
                </span>
                <ArrowRight size={16} color="var(--admin-text-faint)" />
              </Link>
            ))}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Estado del panel</h3>
          </div>
          <p style={{ fontSize: 13, color: "var(--admin-text-secondary)", lineHeight: 1.7 }}>
            Fundaciones (Fase 0) y acceso (Fase 1) están listos. Lo próximo:
          </p>
          <ul style={{ fontSize: 13, color: "var(--admin-text-muted)", margin: "10px 0 0", paddingLeft: 18, lineHeight: 1.9 }}>
            <li>Fase 2 · Dashboard con KPIs y gráficos en vivo</li>
            <li>Fase 3 · Catálogo, media e inventario</li>
            <li>Fase 4 · Pedidos y clientes</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
