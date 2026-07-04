"use client";

import Link from "next/link";
import { Rocket } from "lucide-react";
import { Button } from "@cloudcommerce/ui";

export function ComingSoon({ title, phase, backend }: { title: string; phase: string; backend: string }) {
  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>{title}</h1>
          <div className="admin-ph__sub">Módulo planificado — {phase}</div>
        </div>
      </div>
      <div className="admin-panel admin-empty">
        <Rocket size={40} style={{ opacity: 0.5 }} />
        <h4>{title} llega en {phase}</h4>
        <div style={{ maxWidth: 420, margin: "0 auto", fontSize: 13 }}>
          Pantalla documentada en <span className="admin-mono">docs/admin/</span>. Consume{" "}
          <span className="admin-mono">{backend}</span> del backend ya auditado.
        </div>
        <Link href="/">
          <Button variant="secondary" style={{ marginTop: 18 }}>
            Volver al resumen
          </Button>
        </Link>
      </div>
    </div>
  );
}
