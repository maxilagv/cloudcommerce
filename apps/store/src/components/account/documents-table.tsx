"use client";

import { FileText } from "lucide-react";

/**
 * Fiscal documents panel. The backend does not expose customer documents yet,
 * so this renders an honest empty state (no fake data) — the table view comes
 * back the day `storefront.myDocuments` exists.
 */
export function DocumentsTable() {
  return (
    <div className="bg-cc-shell border border-cc-border-subtle rounded-cc-xl shadow-cc-sm overflow-hidden">
      <div className="px-5 pt-5">
        <h2 className="text-[15px] font-bold text-cc-text">Comprobantes</h2>
      </div>
      <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-cc-soft">
          <FileText className="h-6 w-6 text-cc-muted" strokeWidth={1.6} />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-cc-text">
            Todavía no tenés comprobantes
          </p>
          <p className="mt-1 max-w-[340px] text-[13px] leading-5 text-cc-muted">
            Cuando tus compras tengan facturas, remitos o notas de crédito
            emitidas, vas a poder verlas y descargarlas desde acá.
          </p>
        </div>
      </div>
    </div>
  );
}
