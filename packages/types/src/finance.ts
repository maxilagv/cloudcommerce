import type { Currency, Money } from "./domain.js";
import type { DocumentStatus, DocumentType } from "./enums.js";

// ---------------------------------------------------------------------------
// Contratos de respuesta del dominio `finance` (Fase 5).
// Dos familias: documentos comerciales y reportes financieros.
// El costo/margen son datos SENSIBLES: los presenters no los exponen a roles
// sin permiso (CanViewMarginPolicy → OWNER/ADMIN/FINANCE). Ver [07]/[16].
// ---------------------------------------------------------------------------

/** Vista compacta de un documento comercial (`finance.listDocuments`). */
export type DocumentSummary = {
  id: string;
  type: DocumentType;
  series: string;
  /** Formateado, p. ej. "R-0001" — reconciliado con `AccountDocument.number` del store. */
  displayNumber: string;
  status: DocumentStatus;
  orderId: string | null;
  customerId: string | null;
  total: Money;
  issuedAt: Date | null;
  createdAt: Date;
};

/** Metadata completa de un documento (`finance.getDocument`). Nunca expone `pdfStorageKey`/`contentHash`. */
export type DocumentDetail = DocumentSummary & {
  relatedDocumentId: string | null;
  updatedAt: Date;
};

export type DocumentListResult = {
  items: DocumentSummary[];
  nextCursor: string | null;
};

/** URL firmada de descarga (`finance.getDocumentDownloadUrl`). Expiración corta; nunca un path público estable. */
export type DocumentDownload = {
  url: string;
  expiresAt: Date;
  filename: string;
};

// --- Reportes financieros ---------------------------------------------------

export type FinancePeriodComparison = {
  period: string;
  revenueDeltaPct: number | null;
  marginDeltaPct: number | null;
  ordersDeltaPct: number | null;
};

/** Reporte de un período (`finance.getPeriodReport`). Dinero en enteros menores; divisiones con guarda /0. */
export type FinancePeriodReport = {
  period: string; // 'YYYY-MM'
  currency: Currency;
  revenue: Money;
  cost: Money;
  margin: Money;
  marginPct: number; // 0..1 (0 si revenue = 0)
  ordersCount: number;
  avgTicket: Money;
  /** Nº de líneas sin costo snapshot: el margen queda sobreestimado; se advierte, no se inventa costo. */
  linesMissingCost: number;
  warnings: string[];
  comparison: FinancePeriodComparison | null;
  computedAt: Date;
  fromCache: boolean;
};

export type FinanceKpiTrendPoint = {
  period: string;
  revenue: Money;
  margin: Money;
};

/** KPIs agregados que consume el dashboard (`finance.getKpis`). Finanzas es la única fuente de estos números. */
export type FinanceKpis = {
  range: string;
  totalRevenue: Money;
  totalCost: Money;
  totalMargin: Money;
  marginPct: number;
  ordersCount: number;
  avgTicket: Money;
  trend: FinanceKpiTrendPoint[];
};
