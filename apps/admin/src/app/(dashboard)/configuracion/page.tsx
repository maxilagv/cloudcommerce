"use client";

import Link from "next/link";
import { Monitor, Settings, Users } from "lucide-react";

const SECTIONS = [
  { href: "/configuracion/sesiones", icon: Monitor, label: "Sesiones activas", desc: "Dispositivos con sesion abierta", ready: true },
  { href: "/configuracion/usuarios", icon: Users, label: "Usuarios admin", desc: "Roles, invitaciones y accesos", ready: true },
  { href: "/configuracion/tienda", icon: Settings, label: "Tienda y pagos", desc: "Datos, envios, pagos y flags", ready: true },
];

export default function ConfigPage() {
  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Configuracion</h1>
          <div className="admin-ph__sub">Ajustes de tu cuenta y tu tienda</div>
        </div>
      </div>
      <div className="admin-grid admin-grid--3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const card = (
            <div className="admin-panel" style={{ opacity: s.ready ? 1 : 0.6, cursor: s.ready ? "pointer" : "default" }}>
              <span className="admin-kpi__ic" style={{ marginBottom: 12 }}>
                <Icon size={17} />
              </span>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: "var(--admin-text-muted)", marginTop: 4 }}>{s.desc}</div>
            </div>
          );
          return s.ready ? (
            <Link key={s.label} href={s.href} style={{ textDecoration: "none", color: "inherit" }}>
              {card}
            </Link>
          ) : (
            <div key={s.label}>{card}</div>
          );
        })}
      </div>
    </div>
  );
}
