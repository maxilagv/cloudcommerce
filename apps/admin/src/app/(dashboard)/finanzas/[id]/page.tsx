"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Download, FileText, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Skeleton,
  StatusBadge,
  useToast,
} from "@cloudcommerce/ui";
import { DocumentType, type Currency } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";
import { formatDate, formatMinor } from "@/lib/format";

function moneyLabel(amountMinor: number, currency: Currency): string {
  if (currency === "ARS") return formatMinor(amountMinor);
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD" }).format(amountMinor / 100);
}

function documentTypeLabel(type: DocumentType): string {
  if (type === DocumentType.NOTA_CREDITO) return "Nota de credito";
  if (type === DocumentType.FACTURA) return "Factura";
  return "Remito";
}

export default function FinanceDocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const documentId = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const document = useQuery({
    queryKey: ["finance", "document", documentId],
    queryFn: () => trpc.finance.getDocument.query({ documentId }),
    retry: false,
  });

  const download = useMutation({
    mutationFn: () => trpc.finance.getDocumentDownloadUrl.mutate({ documentId }),
    onSuccess: (result) => {
      window.open(result.url, "_blank", "noopener,noreferrer");
      toast({ tone: "success", title: "Descarga iniciada", message: result.filename });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo descargar", message: err instanceof Error ? err.message : undefined }),
  });

  const regenerate = useMutation({
    mutationFn: () => trpc.finance.regenerateDocument.mutate({ documentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "document", documentId] });
      qc.invalidateQueries({ queryKey: ["finance", "documents"] });
      toast({ tone: "success", title: "Documento regenerado" });
      setConfirmRegenerate(false);
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo regenerar", message: err instanceof Error ? err.message : undefined }),
  });

  if (document.isLoading) {
    return (
      <div className="admin-view">
        <Skeleton height={30} width={220} />
        <div style={{ marginTop: 20 }}>
          <Skeleton height={260} radius={14} />
        </div>
      </div>
    );
  }

  if (document.isError || !document.data) {
    return (
      <div className="admin-view">
        <div className="admin-panel admin-empty">
          <h4>No disponible para tu rol</h4>
          <Button variant="secondary" onClick={() => router.push("/finanzas")} style={{ marginTop: 12 }}>
            Volver a finanzas
          </Button>
        </div>
      </div>
    );
  }

  const item = document.data;

  return (
    <div className="admin-view">
      <button className="admin-back" onClick={() => router.push("/finanzas")}>
        <ArrowLeft size={16} /> Volver a finanzas
      </button>

      <div className="admin-ph">
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <h1>{item.displayNumber}</h1>
          <StatusBadge status={item.status} />
        </div>
        <div className="admin-ph__actions">
          <Button variant="secondary" loading={download.isPending} disabled={item.status !== "AVAILABLE"} onClick={() => download.mutate()}>
            <Download size={16} /> Descargar
          </Button>
          <Button variant="danger" disabled={item.status === "VOID"} onClick={() => setConfirmRegenerate(true)}>
            <RefreshCw size={16} /> Regenerar
          </Button>
        </div>
      </div>

      <div className="admin-detail-grid">
        <div className="admin-panel">
          <div className="admin-panel__h">
            <h3>Vista del documento</h3>
          </div>
          <div className="admin-empty" style={{ padding: "86px 20px" }}>
            <FileText size={42} style={{ opacity: 0.5, marginBottom: 12 }} />
            <h4>{item.displayNumber}</h4>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>Descarga el archivo firmado para revisar el PDF generado.</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="admin-panel">
            <div className="sc-lbl">Metadata</div>
            <div className="admin-detail-kv">
              <span>Tipo</span>
              <Badge tone="info">{documentTypeLabel(item.type)}</Badge>
            </div>
            <div className="admin-detail-kv">
              <span>Serie</span>
              <b className="admin-mono">{item.series}</b>
            </div>
            <div className="admin-detail-kv">
              <span>Total</span>
              <b className="admin-mono">{moneyLabel(item.total.amountMinor, item.total.currency)}</b>
            </div>
            <div className="admin-detail-kv">
              <span>Pedido</span>
              <b className="admin-mono" style={{ fontSize: 12 }}>{item.orderId ?? "-"}</b>
            </div>
            <div className="admin-detail-kv">
              <span>Cliente</span>
              <b className="admin-mono" style={{ fontSize: 12 }}>{item.customerId ?? "-"}</b>
            </div>
          </div>

          <div className="admin-panel">
            <div className="sc-lbl">Fechas</div>
            <div className="admin-detail-kv">
              <span>Emitido</span>
              <b>{item.issuedAt ? formatDate(item.issuedAt) : "-"}</b>
            </div>
            <div className="admin-detail-kv">
              <span>Creado</span>
              <b>{formatDate(item.createdAt)}</b>
            </div>
            <div className="admin-detail-kv">
              <span>Actualizado</span>
              <b>{formatDate(item.updatedAt)}</b>
            </div>
          </div>

          {item.type === DocumentType.NOTA_CREDITO && item.relatedDocumentId && (
            <div className="admin-panel">
              <div className="sc-lbl">Documento relacionado</div>
              <Button variant="secondary" onClick={() => router.push(`/finanzas/${item.relatedDocumentId}`)}>
                Ver factura corregida
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={confirmRegenerate} onOpenChange={(open) => !open && setConfirmRegenerate(false)}>
        <DialogContent
          title="Regenerar documento"
          description={item.displayNumber}
          tone="danger"
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="danger" loading={regenerate.isPending} onClick={() => regenerate.mutate()}>
                Regenerar
              </Button>
            </>
          }
        >
          <div className="admin-cell-sub">Esto reemplaza el archivo PDF existente y conserva la metadata fiscal del documento.</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
