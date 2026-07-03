"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Boxes, Package, TriangleAlert } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Skeleton,
  useToast,
} from "@cloudcommerce/ui";
import type { LowStockAlertsResponse } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";

type LowStockItem = LowStockAlertsResponse["items"][number];

export default function InventoryPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [target, setTarget] = useState<LowStockItem | null>(null);
  const [delta, setDelta] = useState("0");
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: ["inventory", "lowStock"],
    queryFn: () => trpc.dashboard.getLowStockAlerts.query({ limit: 50, threshold: "reorder_point" }),
  });

  const adjust = useMutation({
    mutationFn: () =>
      trpc.inventory.adjustStock.mutate({
        variantId: target!.variantId,
        delta: Number(delta),
        reason: reason.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", "lowStock"] });
      toast({ tone: "success", title: "Stock ajustado" });
      close();
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo ajustar", message: err instanceof Error ? err.message : undefined }),
  });

  function open(item: LowStockItem) {
    setTarget(item);
    setDelta("0");
    setReason("");
  }
  function close() {
    setTarget(null);
  }

  const items = query.data?.items ?? [];
  const deltaNum = Number(delta);
  const canSubmit = Number.isInteger(deltaNum) && deltaNum !== 0 && reason.trim().length >= 3;
  const preview = target ? target.available + (Number.isFinite(deltaNum) ? deltaNum : 0) : 0;

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Inventario</h1>
          <div className="admin-ph__sub">Alertas de stock bajo · {query.data?.totalCount ?? 0} por debajo del reorden</div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="admin-info-strip">
          <TriangleAlert size={17} />
          {items.length} producto(s) necesitan reposición. Ajustá el stock para evitar quiebres.
        </div>
      )}

      <div className="admin-tbl-card">
        {query.isLoading ? (
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={44} radius={10} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="admin-empty" style={{ padding: 48 }}>
            <Boxes size={40} style={{ opacity: 0.5, marginBottom: 12 }} />
            <div style={{ color: "var(--admin-text-secondary)", fontWeight: 600 }}>Todo el stock está en niveles sanos 🎉</div>
          </div>
        ) : (
          <table className="ui-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th style={{ textAlign: "right" }}>Disponible</th>
                <th style={{ textAlign: "right" }}>Reorden</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.variantId}>
                  <td>
                    <div className="admin-mini-prod">
                      <span className="admin-mini-prod__mp">
                        <Package size={16} />
                      </span>
                      <span>
                        <span className="admin-cell-str">{item.productTitle}</span>
                        <span className="admin-cell-sub admin-mono">{item.sku || "sin SKU"}</span>
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }} className="admin-mono">
                    <b style={{ color: item.available <= 0 ? "var(--admin-danger)" : "var(--admin-text-primary)" }}>{item.available}</b>
                  </td>
                  <td style={{ textAlign: "right", color: "var(--admin-text-faint)" }} className="admin-mono">
                    {item.reorderPoint ?? "—"}
                  </td>
                  <td>
                    <Badge tone={item.severity === "out_of_stock" ? "danger" : "warning"}>
                      {item.severity === "out_of_stock" ? "Sin stock" : "Bajo"}
                    </Badge>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Button variant="secondary" size="sm" onClick={() => open(item)}>
                      Ajustar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={target !== null} onOpenChange={(o) => !o && close()}>
        <DialogContent
          title="Ajustar stock"
          description={target?.productTitle}
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="primary" loading={adjust.isPending} disabled={!canSubmit} onClick={() => adjust.mutate()}>
                Confirmar ajuste
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label className="admin-form-g">
              <span>Cantidad (+ suma, − resta)</span>
              <input className="ui-input admin-mono" type="number" value={delta} onChange={(e) => setDelta(e.target.value)} />
            </label>
            <label className="admin-form-g">
              <span>Motivo</span>
              <input className="ui-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Corrección de inventario…" />
            </label>
            {target && Number.isInteger(deltaNum) && deltaNum !== 0 && (
              <div className="admin-cell-sub">
                Disponible pasará de <b className="admin-mono">{target.available}</b> a{" "}
                <b className="admin-mono" style={{ color: preview < 0 ? "var(--admin-danger)" : "var(--admin-success)" }}>{preview}</b>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
