"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Check, ImageOff, Sparkles, Upload, Wand2 } from "lucide-react";
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  Select,
  Skeleton,
  Spinner,
  Switch,
  useToast,
  type BadgeTone,
} from "@cloudcommerce/ui";
import type { AiGeneratedImage, AiImageAnalysis } from "@cloudcommerce/types";
import { trpc } from "@/lib/trpc";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type ImageMode = "enhance" | "generate";
type ImageStyle = "studio" | "lifestyle" | "hero" | "minimal";

const STYLE_OPTIONS: { value: ImageStyle; label: string }[] = [
  { value: "studio", label: "Estudio fondo blanco" },
  { value: "lifestyle", label: "Lifestyle" },
  { value: "hero", label: "Hero banner" },
  { value: "minimal", label: "Minimalista" },
];

/** El backend firma rutas relativas ("/media/assets/..."); las servimos desde el API. */
function resolveMediaUrl(signedUrl: string): string {
  return signedUrl.startsWith("/") ? `${API_URL}${signedUrl}` : signedUrl;
}

/** URL firmada (5 min) para previsualizar un media asset. Reutilizable fuera del diálogo. */
export function useSignedMediaUrl(mediaAssetId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["media", "signed-url", mediaAssetId],
    queryFn: async () => {
      const result = await trpc.media.getSignedUrl.mutate({ mediaAssetId: mediaAssetId!, expiresInSeconds: 300 });
      return resolveMediaUrl(result.signedUrl);
    },
    enabled: enabled && Boolean(mediaAssetId),
    staleTime: 240_000,
    refetchInterval: 240_000,
    retry: false,
  });
}

function isSourceRequiredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("image_source_required") || message.includes("imagen fuente");
}

function scoreTone(score: number): BadgeTone {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Buena calidad";
  if (score >= 50) return "Mejorable";
  return "Baja calidad";
}

export interface ImageStudioTarget {
  kind: "product" | "category";
  id: string;
  title: string;
  mainImageMediaId: string | null;
}

export interface ImageStudioDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ImageStudioTarget;
  /** Se llama cuando la imagen generada quedó aplicada como imagen principal. */
  onApplied?: () => void;
}

export function ImageStudioDialog({ open, onOpenChange, target, onApplied }: ImageStudioDialogProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [sourceId, setSourceId] = useState<string | null>(target.mainImageMediaId);
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState<AiImageAnalysis | null>(null);
  const [mode, setMode] = useState<ImageMode>("enhance");
  const [style, setStyle] = useState<ImageStyle>("studio");
  const [instructions, setInstructions] = useState("");
  const [applyToTarget, setApplyToTarget] = useState(true);
  const [result, setResult] = useState<AiGeneratedImage | null>(null);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSourceId(target.mainImageMediaId);
    setAnalysis(null);
    setResult(null);
    setApplied(false);
    setInstructions("");
    setMode(target.mainImageMediaId ? "enhance" : "generate");
  }, [open, target.id, target.mainImageMediaId]);

  const sourceUrl = useSignedMediaUrl(sourceId, open);
  const resultUrl = useSignedMediaUrl(result?.mediaAssetId ?? null, open);

  const targetInput = target.kind === "product" ? { productId: target.id } : { categoryId: target.id };

  async function uploadSource(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${API_URL}/media/upload`, { method: "POST", body: form, credentials: "include" });
      if (!response.ok) throw new Error(`No se pudo subir la imagen (HTTP ${response.status})`);
      const json = (await response.json()) as { data: { id: string } };
      setSourceId(json.data.id);
      setAnalysis(null);
      toast({ tone: "success", title: "Imagen fuente subida" });
    } catch (err) {
      toast({ tone: "error", title: "No se pudo subir la imagen", message: err instanceof Error ? err.message : undefined });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const analyze = useMutation({
    mutationFn: () =>
      trpc.ai.analyzeImage.mutate({
        ...targetInput,
        ...(sourceId ? { sourceMediaAssetId: sourceId } : {}),
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ["ai"] });
      if (response.analysis) {
        setAnalysis(response.analysis);
        toast({ tone: "success", title: "Análisis completado" });
      } else {
        toast({ tone: "info", title: "Generación duplicada", message: "Revisá el historial de IA para ver el resultado." });
      }
    },
    onError: (err) =>
      toast({
        tone: "error",
        title: "No se pudo analizar",
        message: isSourceRequiredError(err)
          ? "Necesitás una imagen fuente: subí una foto del producto para analizarla."
          : err instanceof Error
            ? err.message
            : undefined,
      }),
  });

  const generate = useMutation({
    mutationFn: () =>
      trpc.ai.generateImage.mutate({
        ...targetInput,
        mode,
        style,
        ...(sourceId ? { sourceMediaAssetId: sourceId } : {}),
        ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        applyToTarget,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (response) => {
      qc.invalidateQueries({ queryKey: ["ai"] });
      if (!response.image) {
        toast({ tone: "info", title: "Generación duplicada", message: "Revisá el historial de IA para ver el resultado." });
        return;
      }
      setResult(response.image);
      setApplied(response.image.appliedToTarget);
      if (response.image.appliedToTarget) {
        onApplied?.();
        toast({ tone: "success", title: "Imagen generada y aplicada" });
      } else {
        toast({ tone: "success", title: "Imagen generada" });
      }
    },
    onError: (err) =>
      toast({
        tone: "error",
        title: "No se pudo generar la imagen",
        message: isSourceRequiredError(err)
          ? "El modo Mejorar necesita una imagen fuente: subí una foto o cambiá al modo Crear."
          : err instanceof Error
            ? err.message
            : undefined,
      }),
  });

  const applyAfter = useMutation({
    mutationFn: async () => {
      if (target.kind === "product") {
        await trpc.catalog.products.update.mutate({ id: target.id, mainImageId: result!.mediaAssetId });
      } else {
        await trpc.catalog.categories.update.mutate({ id: target.id, imageId: result!.mediaAssetId });
      }
    },
    onSuccess: () => {
      setApplied(true);
      onApplied?.();
      toast({ tone: "success", title: "Imagen principal actualizada" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo aplicar", message: err instanceof Error ? err.message : undefined }),
  });

  const busy = uploading || analyze.isPending || generate.isPending || applyAfter.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !generate.isPending && onOpenChange(false)}>
      <DialogContent
        className="ui-dialog--wide"
        title="Estudio de imagen IA"
        description={`${target.kind === "product" ? "Producto" : "Categoría"}: ${target.title}`}
        footer={
          <>
            <DialogClose asChild>
              <Button variant="ghost" disabled={generate.isPending}>Cerrar</Button>
            </DialogClose>
            {result && !applied && (
              <Button variant="primary" loading={applyAfter.isPending} onClick={() => applyAfter.mutate()}>
                <Check size={16} /> Aplicar como imagen principal
              </Button>
            )}
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Imagen fuente */}
          <div>
            <div className="sc-lbl">Imagen fuente</div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginTop: 8 }}>
              <div
                style={{
                  width: 130,
                  height: 130,
                  borderRadius: 12,
                  border: "1px solid var(--admin-border-default)",
                  background: "var(--admin-bg-inset, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  flexShrink: 0,
                }}
              >
                {sourceId ? (
                  sourceUrl.isLoading ? (
                    <Skeleton height={130} width={130} radius={12} />
                  ) : sourceUrl.data ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sourceUrl.data} alt="Imagen fuente" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                  ) : (
                    <ImageOff size={26} style={{ opacity: 0.4 }} />
                  )
                ) : (
                  <ImageOff size={26} style={{ opacity: 0.4 }} />
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                <div className="admin-cell-sub">
                  {sourceId
                    ? sourceId === target.mainImageMediaId
                      ? "Se usa la imagen principal actual como fuente."
                      : "Se usa la imagen que subiste como fuente."
                    : "Sin imagen fuente. Podés subir una foto o crear desde cero."}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Button variant="secondary" size="sm" loading={uploading} disabled={busy && !uploading} onClick={() => fileRef.current?.click()}>
                    <Upload size={15} /> Subir imagen
                  </Button>
                  <Button variant="secondary" size="sm" loading={analyze.isPending} disabled={busy || !sourceId} onClick={() => analyze.mutate()}>
                    <Sparkles size={15} /> Analizar con IA
                  </Button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadSource(file);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Análisis */}
          {analysis && (
            <div style={{ border: "1px solid var(--admin-border-default)", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 34, fontWeight: 750, lineHeight: 1 }}>{analysis.qualityScore}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Badge tone={scoreTone(analysis.qualityScore)}>{scoreLabel(analysis.qualityScore)}</Badge>
                  {!analysis.isUsableSource && <Badge tone="danger">No sirve como fuente</Badge>}
                </div>
              </div>
              <div className="admin-cell-sub" style={{ marginTop: 8 }}>{analysis.summary}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
                <div>
                  <div className="sc-lbl">Fortalezas</div>
                  {analysis.strengths.length === 0 ? (
                    <div className="admin-cell-sub">—</div>
                  ) : (
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12.5, color: "var(--admin-text-secondary)" }}>
                      {analysis.strengths.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </div>
                <div>
                  <div className="sc-lbl">Problemas</div>
                  {analysis.issues.length === 0 ? (
                    <div className="admin-cell-sub">—</div>
                  ) : (
                    <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12.5, color: "var(--admin-text-secondary)" }}>
                      {analysis.issues.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  )}
                </div>
              </div>
              {analysis.enhancementPlan && (
                <div style={{ marginTop: 10 }}>
                  <div className="sc-lbl">Plan de mejora</div>
                  <div className="admin-cell-sub" style={{ marginTop: 4 }}>{analysis.enhancementPlan}</div>
                </div>
              )}
            </div>
          )}

          {/* Controles de generación */}
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div className="admin-segs">
                <button data-on={mode === "enhance" || undefined} disabled={busy} onClick={() => setMode("enhance")}>Mejorar</button>
                <button data-on={mode === "generate" || undefined} disabled={busy} onClick={() => setMode("generate")}>Crear</button>
              </div>
              <div style={{ minWidth: 200 }}>
                <Select
                  value={style}
                  disabled={busy}
                  onChange={(event) => setStyle(event.target.value as ImageStyle)}
                  options={STYLE_OPTIONS}
                />
              </div>
            </div>
            <label className="admin-form-g">
              <span>Instrucciones (opcional)</span>
              <textarea
                className="ui-input"
                rows={2}
                maxLength={500}
                disabled={busy}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Ej: resaltar el frente del producto, luz cálida, sin sombras duras"
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <Switch checked={applyToTarget} disabled={busy} onCheckedChange={setApplyToTarget} />
              <span style={{ fontSize: 13, color: "var(--admin-text-secondary)" }}>Aplicar como imagen principal al terminar</span>
            </label>
            <Button
              variant="primary"
              loading={generate.isPending}
              disabled={busy || (mode === "enhance" && !sourceId)}
              onClick={() => {
                setResult(null);
                setApplied(false);
                generate.mutate();
              }}
            >
              <Wand2 size={16} /> Generar imagen
            </Button>
            {mode === "enhance" && !sourceId && (
              <div className="admin-cell-sub">El modo Mejorar necesita una imagen fuente. Subí una foto o pasá al modo Crear.</div>
            )}
          </div>

          {/* Estado de generación */}
          {generate.isPending && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                padding: "26px 0",
                border: "1px dashed var(--admin-border-default)",
                borderRadius: 12,
              }}
            >
              <Spinner size={26} />
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>La IA está retocando la imagen…</div>
              <div className="admin-cell-sub">Puede tardar 2-3 minutos. No cierres esta ventana.</div>
            </div>
          )}

          {/* Resultado */}
          {result && !generate.isPending && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="admin-panel__h" style={{ marginBottom: 0 }}>
                <h3>Resultado</h3>
                {applied ? <Badge tone="success">Aplicada como principal</Badge> : <Badge tone="info">Sin aplicar</Badge>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div className="sc-lbl">Antes</div>
                  <div style={{ marginTop: 6, borderRadius: 12, border: "1px solid var(--admin-border-default)", overflow: "hidden", minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {sourceUrl.data ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sourceUrl.data} alt="Antes" style={{ width: "100%", objectFit: "contain" }} />
                    ) : (
                      <span className="admin-cell-sub" style={{ padding: 20 }}>Sin imagen fuente</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="sc-lbl">Después</div>
                  <div style={{ marginTop: 6, borderRadius: 12, border: "1px solid var(--admin-accent)", overflow: "hidden", minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {resultUrl.isLoading ? (
                      <Skeleton height={160} radius={0} />
                    ) : resultUrl.data ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resultUrl.data} alt="Después" style={{ width: "100%", objectFit: "contain" }} />
                    ) : (
                      <span className="admin-cell-sub" style={{ padding: 20 }}>No se pudo previsualizar</span>
                    )}
                  </div>
                </div>
              </div>
              <details>
                <summary style={{ cursor: "pointer", fontSize: 12.5, color: "var(--admin-text-muted)" }}>Ver prompt usado</summary>
                <div className="admin-cell-sub admin-mono" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{result.promptUsed}</div>
              </details>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
