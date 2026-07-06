"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, HandCoins, PackageX, Percent, Store } from "lucide-react";
import { Badge, Button, Skeleton, Switch, useToast } from "@cloudcommerce/ui";
import { trpc } from "@/lib/trpc";
import { formatMinor } from "@/lib/format";

const nf = new Intl.NumberFormat("es-AR");

/** Primer día del mes actual (input type=month → rango [from, to)). */
function monthRange(month: string): { from: Date; to: Date } {
  const [year, m] = month.split("-").map(Number);
  return { from: new Date(year!, m! - 1, 1), to: new Date(year!, m!, 1) };
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Modo reventa: config del tramo mayorista + venta sin stock, y liquidaciones
 * de rebates por proveedor.
 */
export function ResalePanels() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
      <ResaleConfigPanel />
      <SupplierRebatePanel />
    </div>
  );
}

function ResaleConfigPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const config = useQuery({
    queryKey: ["pricing", "resale", "config"],
    queryFn: () => trpc.pricing.resale.getConfig.query(),
  });

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [minQty, setMinQty] = useState<string | null>(null);
  const [marginBps, setMarginBps] = useState<string | null>(null);
  const [backorder, setBackorder] = useState<boolean | null>(null);

  const effective = {
    wholesaleEnabled: enabled ?? config.data?.wholesaleEnabled ?? false,
    wholesaleMinQty: Number(minQty ?? config.data?.wholesaleMinQty ?? 4),
    wholesaleMarginBps: Number(marginBps ?? config.data?.wholesaleMarginBps ?? 0),
    allowBackorder: backorder ?? config.data?.allowBackorder ?? false,
  };

  const save = useMutation({
    mutationFn: () => trpc.pricing.resale.updateConfig.mutate(effective),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing"] });
      toast({ tone: "success", title: "Modo reventa actualizado" });
    },
    onError: (err) =>
      toast({ tone: "error", title: "No se pudo guardar", message: err instanceof Error ? err.message : undefined }),
  });

  return (
    <div className="admin-panel">
      <div className="admin-panel__h">
        <h3 style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Store size={16} /> Modo reventa
        </h3>
        {config.data?.wholesaleEnabled && <Badge tone="success">Mayorista activo</Badge>}
      </div>
      {config.isLoading ? (
        <Skeleton height={90} radius={12} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--admin-text-secondary)" }}>
            <Switch checked={effective.wholesaleEnabled} onCheckedChange={(v) => setEnabled(v)} />
            Precio mayorista por cantidad (el minorista sigue saliendo de las reglas de markup)
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 460 }}>
            <label className="admin-form-g">
              <span>Unidades para precio mayorista</span>
              <input
                className="ui-input admin-mono"
                type="number"
                min={2}
                max={999}
                value={effective.wholesaleMinQty}
                onChange={(e) => setMinQty(e.target.value)}
              />
            </label>
            <label className="admin-form-g">
              <span>Margen mayorista (bps; 0 = costo)</span>
              <input
                className="ui-input admin-mono"
                type="number"
                min={0}
                max={100000}
                value={effective.wholesaleMarginBps}
                onChange={(e) => setMarginBps(e.target.value)}
              />
            </label>
          </div>
          <div className="admin-cell-sub">
            Comprando {effective.wholesaleMinQty}+ unidades el cliente paga costo del proveedor
            {effective.wholesaleMarginBps > 0 ? ` + ${effective.wholesaleMarginBps / 100}%` : " exacto"}.
            Tu ganancia en ese tramo es el rebate del proveedor (panel de abajo).
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--admin-text-secondary)" }}>
            <Switch checked={effective.allowBackorder} onCheckedChange={(v) => setBackorder(v)} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <PackageX size={14} /> Vender sin stock (dropshipping puro: nada se muestra agotado y el
              checkout nunca bloquea por stock)
            </span>
          </label>
          <div>
            <Button variant="primary" loading={save.isPending} onClick={() => save.mutate()}>
              <Check size={15} /> Guardar modo reventa
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SupplierRebatePanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [editingRebate, setEditingRebate] = useState<Record<string, string>>({});

  const range = monthRange(month);
  const report = useQuery({
    queryKey: ["pricing", "resale", "rebates", month],
    queryFn: () => trpc.pricing.resale.rebateReport.query({ from: range.from, to: range.to }),
  });

  const setRebate = useMutation({
    mutationFn: (input: { supplierId: string; rebateBps: number }) =>
      trpc.pricing.resale.setSupplierRebate.mutate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pricing", "resale", "rebates"] });
      toast({ tone: "success", title: "Rebate actualizado" });
    },
    onError: (err) =>
      toast({ tone: "error", title: "No se pudo actualizar", message: err instanceof Error ? err.message : undefined }),
  });

  const rows = report.data ?? [];
  const totals = rows.reduce(
    (acc, row) => ({
      sales: acc.sales + row.salesMinor,
      rebate: acc.rebate + row.expectedRebateMinor,
    }),
    { sales: 0, rebate: 0 },
  );

  return (
    <div className="admin-tbl-card">
      <div className="admin-toolbar">
        <span className="admin-cell-sub" style={{ margin: 0, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <HandCoins size={14} /> Liquidaciones por proveedor — para cotejar el rebate que te pagan.
        </span>
        <div style={{ marginLeft: "auto" }}>
          <input
            className="ui-input"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Mes del reporte"
          />
        </div>
      </div>

      {report.isLoading ? (
        <div style={{ padding: 20 }}><Skeleton height={100} radius={12} /></div>
      ) : rows.length === 0 ? (
        <div className="admin-empty" style={{ padding: "40px 0" }}>
          <HandCoins size={34} style={{ opacity: 0.4, marginBottom: 10 }} />
          <div style={{ fontWeight: 600, color: "var(--admin-text-secondary)" }}>Sin ventas en el período</div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>
            Las ventas nuevas quedan asociadas al proveedor del costo automáticamente.
          </div>
        </div>
      ) : (
        <>
          <table className="ui-table">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th style={{ textAlign: "right" }}>Pedidos</th>
                <th style={{ textAlign: "right" }}>Unidades</th>
                <th style={{ textAlign: "right" }}>Ventas</th>
                <th style={{ textAlign: "right" }}>Costo proveedor</th>
                <th style={{ textAlign: "right" }}>Rebate</th>
                <th style={{ textAlign: "right" }}>Comisión esperada</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const key = row.supplierId ?? "none";
                const editing = editingRebate[key];
                return (
                  <tr key={key}>
                    <td>
                      <span className="admin-cell-str">{row.supplierName ?? "Sin proveedor asignado"}</span>
                      {!row.supplierId && (
                        <span className="admin-cell-sub">Ventas previas al registro de proveedor por línea</span>
                      )}
                    </td>
                    <td className="admin-mono" style={{ textAlign: "right" }}>{nf.format(row.orders)}</td>
                    <td className="admin-mono" style={{ textAlign: "right" }}>{nf.format(row.unitsSold)}</td>
                    <td className="admin-mono" style={{ textAlign: "right", fontWeight: 700 }}>
                      {formatMinor(row.salesMinor)}
                    </td>
                    <td className="admin-mono" style={{ textAlign: "right" }}>
                      {formatMinor(row.supplierCostMinor)}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {row.supplierId ? (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <input
                            className="ui-input admin-mono"
                            style={{ width: 76, textAlign: "right", padding: "4px 8px" }}
                            type="number"
                            min={0}
                            max={10000}
                            value={editing ?? String(row.rebateBps)}
                            onChange={(e) =>
                              setEditingRebate((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            onBlur={() => {
                              const next = Number(editing ?? row.rebateBps);
                              if (editing !== undefined && next !== row.rebateBps) {
                                setRebate.mutate({ supplierId: row.supplierId!, rebateBps: next });
                              }
                            }}
                            aria-label={`Rebate de ${row.supplierName ?? "proveedor"} en basis points`}
                          />
                          <Percent size={12} style={{ color: "var(--admin-text-faint)" }} />
                        </span>
                      ) : (
                        "—"
                      )}
                      <div className="admin-cell-sub" style={{ textAlign: "right" }}>
                        {(row.rebateBps / 100).toFixed(2)}%
                      </div>
                    </td>
                    <td
                      className="admin-mono"
                      style={{ textAlign: "right", fontWeight: 800, color: "var(--admin-success)" }}
                    >
                      {formatMinor(row.expectedRebateMinor)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontWeight: 700 }}>Total del mes</td>
                <td />
                <td />
                <td className="admin-mono" style={{ textAlign: "right", fontWeight: 800 }}>
                  {formatMinor(totals.sales)}
                </td>
                <td />
                <td />
                <td className="admin-mono" style={{ textAlign: "right", fontWeight: 800, color: "var(--admin-success)" }}>
                  {formatMinor(totals.rebate)}
                </td>
              </tr>
            </tfoot>
          </table>
          <div className="admin-cell-sub" style={{ padding: "10px 14px" }}>
            El rebate se edita en basis points (300 = 3%). La comisión esperada = ventas del período ×
            rebate del proveedor. No incluye pedidos cancelados ni devueltos.
          </div>
        </>
      )}
    </div>
  );
}
