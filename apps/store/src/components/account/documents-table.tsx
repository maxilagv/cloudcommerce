"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { mockDocuments, type AccountDocument } from "@/lib/mock-account";
import { formatCOP } from "@/lib/utils";

type Tab = "remito" | "factura" | "nota-credito";

const tabs: { id: Tab; label: string }[] = [
  { id: "remito", label: "Remitos" },
  { id: "factura", label: "Facturas" },
  { id: "nota-credito", label: "Notas de crédito" },
];

export function DocumentsTable() {
  const [activeTab, setActiveTab] = useState<Tab>("remito");

  const filtered = mockDocuments.filter((d) => d.type === activeTab);

  return (
    <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm overflow-hidden">
      {/* Tabs */}
      <div className="flex border-b border-cc-border-subtle px-5 pt-5 gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              "px-4 py-2 text-[13px] font-semibold rounded-t-cc-sm border-b-2 transition-colors duration-[140ms] ease-cc-out -mb-px",
              activeTab === tab.id
                ? "border-cc-primary text-cc-primary bg-cc-primary-soft"
                : "border-transparent text-cc-muted hover:text-cc-text",
            ].join(" ")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-cc-bg-surface-soft text-[11px] font-semibold text-cc-muted uppercase tracking-wide">
              <th className="px-5 py-3">Número</th>
              <th className="px-5 py-3">Pedido</th>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right">Descargar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cc-border-subtle">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-8 text-center text-[13px] text-cc-muted"
                >
                  No hay documentos disponibles.
                </td>
              </tr>
            ) : (
              filtered.map((doc: AccountDocument) => (
                <tr
                  key={doc.number}
                  className="hover:bg-[#F8FAFD] transition-colors duration-[120ms]"
                >
                  <td className="px-5 py-3.5 text-[13px] font-semibold text-cc-text">
                    {doc.number}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-cc-secondary">
                    #{doc.orderId}
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-cc-secondary">
                    {doc.date}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={[
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
                        doc.status === "available"
                          ? "bg-cc-success-soft text-cc-success"
                          : "bg-cc-warning-soft text-cc-warning",
                      ].join(" ")}
                    >
                      {doc.status === "available" ? "Disponible" : "Procesando"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-[13px] font-semibold text-cc-text text-right">
                    {formatCOP(doc.total)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-cc-xs border border-cc-primary-border text-[12px] font-semibold text-cc-primary bg-cc-primary-soft hover:bg-cc-primary hover:text-white transition-colors duration-[140ms] ease-cc-out"
                    >
                      <Download className="h-3 w-3" strokeWidth={2} />
                      PDF
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
