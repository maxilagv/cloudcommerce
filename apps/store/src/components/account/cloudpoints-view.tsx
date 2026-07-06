"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Copy,
  Gift,
  History,
  Package,
  RotateCcw,
  Sparkles,
  Star,
  Ticket,
} from "lucide-react";
import {
  LoyaltyRedemptionStatus,
  LoyaltyRewardKind,
  LoyaltyTransactionType,
  type LoyaltyRedemptionView,
  type LoyaltyRewardView,
  type LoyaltyTransactionView,
} from "@cloudcommerce/types";
import { useCloudPoints } from "@/hooks/use-cloudpoints";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "@/store/toast";
import { Modal } from "@/components/ui/modal";

const nf = new Intl.NumberFormat("es-AR");

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

/** "Rota en 3 días" / "Rota hoy" a partir de availableUntil. */
function rotationLabel(availableUntil: string | null): string | null {
  if (!availableUntil) return null;
  const ms = new Date(availableUntil).getTime() - Date.now();
  if (ms <= 0) return null;
  const days = Math.floor(ms / 86_400_000);
  if (days >= 2) return `Rota en ${days} días`;
  if (days === 1) return "Rota mañana";
  const hours = Math.max(1, Math.floor(ms / 3_600_000));
  return `Rota en ${hours} h`;
}

const TX_META: Record<
  LoyaltyTransactionType,
  { label: string; icon: typeof ArrowUpRight }
> = {
  [LoyaltyTransactionType.EARN]: { label: "Compra entregada", icon: ArrowUpRight },
  [LoyaltyTransactionType.REDEEM]: { label: "Canje", icon: Gift },
  [LoyaltyTransactionType.REVERSAL]: { label: "Reversa", icon: RotateCcw },
  [LoyaltyTransactionType.ADJUST]: { label: "Ajuste", icon: Sparkles },
};

const STATUS_META: Record<LoyaltyRedemptionStatus, { label: string; className: string }> = {
  [LoyaltyRedemptionStatus.PENDING]: {
    label: "Pendiente de entrega",
    className: "bg-cc-warning-soft text-cc-warning",
  },
  [LoyaltyRedemptionStatus.FULFILLED]: {
    label: "Entregado",
    className: "bg-cc-success-soft text-cc-success",
  },
  [LoyaltyRedemptionStatus.CANCELLED]: {
    label: "Cancelado",
    className: "bg-cc-soft text-cc-muted",
  },
};

export function CloudPointsView() {
  const { summary, rewards, transactions, redemptions, loading, refresh } = useCloudPoints();
  const [toRedeem, setToRedeem] = useState<LoyaltyRewardView | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [justRedeemed, setJustRedeemed] = useState<LoyaltyRedemptionView | null>(null);

  const balance = summary?.balance ?? 0;
  const rate = summary?.config.pointsPer1000 ?? 1;
  const programEnabled = summary?.config.isEnabled ?? true;

  const idempotencyKey = useMemo(
    () => (toRedeem ? crypto.randomUUID() : ""),
    [toRedeem],
  );

  async function confirmRedeem() {
    if (!toRedeem) return;
    setRedeeming(true);
    try {
      const result = await trpc.loyalty.my.redeem.mutate({
        rewardId: toRedeem.id,
        idempotencyKey,
      });
      setToRedeem(null);
      setJustRedeemed(result.redemption);
      toast.success("¡Canje realizado!", {
        description: `Te quedan ${nf.format(result.balance)} CloudPoints.`,
      });
      void refresh();
    } catch (error) {
      toast.error("No pudimos canjear el regalo", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRedeeming(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado");
    } catch {
      toast.error("No se pudo copiar el código");
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Cargando CloudPoints">
        <div className="cc-skeleton h-[140px] rounded-cc-xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="cc-skeleton h-[180px] rounded-cc-xl" />
          <div className="cc-skeleton h-[180px] rounded-cc-xl" />
          <div className="cc-skeleton h-[180px] rounded-cc-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Saldo */}
      <section
        aria-labelledby="cloudpoints-balance-title"
        className="relative overflow-hidden rounded-cc-xl border border-cc-border bg-[radial-gradient(circle_at_82%_18%,rgba(255,255,255,.28),transparent_38%),linear-gradient(130deg,#0B6BFF,#004ECC)] p-6 text-white shadow-cc-md"
      >
        <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              id="cloudpoints-balance-title"
              className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.16em] text-white/85"
            >
              <Star className="h-4 w-4" fill="currentColor" /> Tus CloudPoints
            </p>
            <p className="mt-2 text-[44px] font-black leading-none tracking-[-0.03em] tabular-nums">
              {nf.format(balance)}
            </p>
            <p className="mt-2 text-[13px] text-white/80">
              Acumulaste {nf.format(summary?.lifetimeEarned ?? 0)} puntos en total.
            </p>
          </div>
          <div className="rounded-cc-lg bg-white/12 px-4 py-3 text-[13px] leading-5 backdrop-blur-sm">
            <p className="font-bold">¿Cómo sumo puntos?</p>
            <p className="text-white/85">
              Ganás <strong>{rate}</strong> {rate === 1 ? "punto" : "puntos"} por cada $1.000 en
              compras entregadas.
            </p>
          </div>
        </div>
        {!programEnabled && (
          <p role="status" className="relative mt-4 rounded-cc-md bg-white/15 px-3 py-2 text-[13px] font-semibold">
            El programa está pausado por el momento — tus puntos siguen guardados.
          </p>
        )}
      </section>

      {/* Regalos de la rotación */}
      <section aria-labelledby="cloudpoints-rewards-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="cloudpoints-rewards-title" className="text-[18px] font-bold text-cc-text">
              Regalos de esta rotación
            </h2>
            <p className="text-[13px] text-cc-muted">
              Los regalos van rotando semana a semana — si te gusta uno, no lo dejes pasar.
            </p>
          </div>
        </div>

        {rewards.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-cc-xl border border-dashed border-cc-border bg-cc-surface py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-cc-soft">
              <Gift className="h-6 w-6 text-cc-muted" strokeWidth={1.6} />
            </span>
            <p className="text-[14px] font-semibold text-cc-text">
              La próxima rotación está en camino
            </p>
            <p className="max-w-[320px] text-[13px] text-cc-muted">
              Seguí sumando CloudPoints con tus compras: los nuevos regalos aparecen acá.
            </p>
          </div>
        ) : (
          <ul className="cc-stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="list">
            {rewards.map((reward) => {
              const rotation = rotationLabel(reward.availableUntil);
              const outOfStock = reward.stock !== null && reward.stock <= 0;
              const affordable = balance >= reward.pointsCost;
              const disabled = outOfStock || !affordable || !programEnabled;
              return (
                <li
                  key={reward.id}
                  className="group flex flex-col rounded-cc-xl border border-cc-border bg-cc-surface p-4 shadow-cc-xs transition-[transform,border-color,box-shadow] duration-[220ms] ease-cc-out hover:-translate-y-[3px] hover:border-cc-primary-border hover:shadow-cc-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
                        reward.kind === LoyaltyRewardKind.PHYSICAL
                          ? "bg-cc-primary-soft text-cc-primary"
                          : "bg-cc-success-soft text-cc-success",
                      )}
                    >
                      {reward.kind === LoyaltyRewardKind.PHYSICAL ? (
                        <Package className="h-3 w-3" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      {reward.kind === LoyaltyRewardKind.PHYSICAL ? "Regalo físico" : "Beneficio digital"}
                    </span>
                    {rotation && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cc-warning">
                        <Clock className="h-3 w-3" /> {rotation}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 text-[15px] font-bold leading-snug text-cc-text">
                    {reward.title}
                  </h3>
                  {reward.description && (
                    <p className="mt-1 text-[13px] leading-5 text-cc-secondary">
                      {reward.description}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <div>
                      <p className="text-[17px] font-black tabular-nums text-cc-text">
                        {nf.format(reward.pointsCost)} <span className="text-[11px] font-bold text-cc-muted">pts</span>
                      </p>
                      {reward.stock !== null && reward.stock > 0 && reward.stock <= 5 && (
                        <p className="text-[11px] font-semibold text-cc-warning">
                          ¡Quedan {reward.stock}!
                        </p>
                      )}
                      {outOfStock && (
                        <p className="text-[11px] font-semibold text-cc-muted">Agotado</p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => setToRedeem(reward)}
                      className={cn(
                        "cc-focus-ring h-10 rounded-full px-4 text-[13px] font-bold transition-[transform,background,box-shadow] duration-[160ms] ease-cc-out",
                        disabled
                          ? "cursor-not-allowed bg-cc-soft text-cc-faint"
                          : "bg-cc-primary text-white shadow-[0_10px_22px_rgba(11,107,255,.24)] hover:bg-cc-primary-hover active:scale-[0.97]",
                      )}
                    >
                      {outOfStock ? "Agotado" : affordable ? "Canjear" : "Te faltan puntos"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Movimientos */}
        <section
          aria-labelledby="cloudpoints-history-title"
          className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-5 shadow-cc-sm"
        >
          <h2
            id="cloudpoints-history-title"
            className="flex items-center gap-2 text-[15px] font-bold text-cc-text"
          >
            <History className="h-4 w-4 text-cc-primary" /> Movimientos
          </h2>
          {transactions.length === 0 ? (
            <p className="mt-4 text-[13px] text-cc-muted">
              Todavía no hay movimientos. Tus puntos aparecen acá cuando se entrega una compra.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-cc-border-subtle" role="list">
              {transactions.slice(0, 8).map((tx: LoyaltyTransactionView) => {
                const meta = TX_META[tx.type];
                const Icon = tx.points >= 0 ? meta.icon : tx.type === LoyaltyTransactionType.REDEEM ? Gift : ArrowDownRight;
                const positive = tx.points >= 0;
                return (
                  <li key={tx.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={cn(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-full",
                        positive ? "bg-cc-success-soft text-cc-success" : "bg-cc-soft text-cc-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-cc-text">
                        {tx.reason}
                      </span>
                      <span className="block text-[11px] text-cc-muted">
                        {meta.label} · {formatDate(tx.createdAt)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "text-[14px] font-black tabular-nums",
                        positive ? "text-cc-success" : "text-cc-text",
                      )}
                    >
                      {positive ? "+" : ""}
                      {nf.format(tx.points)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Mis canjes */}
        <section
          aria-labelledby="cloudpoints-redemptions-title"
          className="rounded-cc-xl border border-cc-border-subtle bg-cc-shell p-5 shadow-cc-sm"
        >
          <h2
            id="cloudpoints-redemptions-title"
            className="flex items-center gap-2 text-[15px] font-bold text-cc-text"
          >
            <Ticket className="h-4 w-4 text-cc-primary" /> Mis canjes
          </h2>
          {redemptions.length === 0 ? (
            <p className="mt-4 text-[13px] text-cc-muted">
              Cuando canjees un regalo vas a ver acá el código para retirarlo.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3" role="list">
              {redemptions.map((redemption) => {
                const status = STATUS_META[redemption.status];
                return (
                  <li
                    key={redemption.id}
                    className="rounded-cc-lg border border-cc-border-subtle bg-cc-surface p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[13px] font-bold text-cc-text">
                        {redemption.rewardTitle}
                      </p>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                          status.className,
                        )}
                      >
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => copyCode(redemption.code)}
                        aria-label={`Copiar código ${redemption.code}`}
                        className="cc-focus-ring inline-flex items-center gap-1.5 rounded-cc-sm bg-cc-soft px-2.5 py-1 font-mono text-[13px] font-bold tracking-wide text-cc-text transition-colors hover:bg-cc-primary-soft hover:text-cc-primary"
                      >
                        {redemption.code}
                        <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                      <span className="text-[11px] text-cc-muted">
                        {nf.format(redemption.pointsSpent)} pts · {formatDate(redemption.createdAt)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Confirmación de canje */}
      <Modal
        open={toRedeem !== null}
        onClose={() => !redeeming && setToRedeem(null)}
        title="Confirmar canje"
        footer={
          <>
            <button
              type="button"
              onClick={() => setToRedeem(null)}
              disabled={redeeming}
              className="cc-focus-ring rounded-cc-sm px-4 py-2 text-[13px] font-medium text-cc-secondary hover:bg-cc-soft"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void confirmRedeem()}
              disabled={redeeming}
              className="cc-focus-ring rounded-cc-sm bg-cc-primary px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-cc-primary-hover disabled:opacity-60"
            >
              {redeeming ? "Canjeando…" : "Canjear ahora"}
            </button>
          </>
        }
      >
        {toRedeem && (
          <div className="flex flex-col gap-3 text-[14px] text-cc-secondary">
            <p>
              Vas a canjear <strong className="text-cc-text">{toRedeem.title}</strong> por{" "}
              <strong className="text-cc-text">{nf.format(toRedeem.pointsCost)} CloudPoints</strong>.
            </p>
            <p className="rounded-cc-md bg-cc-soft px-3 py-2 text-[13px]">
              Saldo después del canje:{" "}
              <strong className="text-cc-text tabular-nums">
                {nf.format(balance - toRedeem.pointsCost)} pts
              </strong>
            </p>
          </div>
        )}
      </Modal>

      {/* Código del canje recién hecho */}
      <Modal
        open={justRedeemed !== null}
        onClose={() => setJustRedeemed(null)}
        title="¡Regalo canjeado!"
        footer={
          <button
            type="button"
            onClick={() => setJustRedeemed(null)}
            className="cc-focus-ring rounded-cc-sm bg-cc-primary px-5 py-2 text-[13px] font-semibold text-white hover:bg-cc-primary-hover"
          >
            Listo
          </button>
        }
      >
        {justRedeemed && (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-cc-success-soft">
              <Gift className="h-6 w-6 text-cc-success" strokeWidth={1.8} />
            </span>
            <p className="text-[14px] text-cc-secondary">
              Canjeaste <strong className="text-cc-text">{justRedeemed.rewardTitle}</strong>. Este
              es tu código — también queda guardado en “Mis canjes”.
            </p>
            <button
              type="button"
              onClick={() => copyCode(justRedeemed.code)}
              aria-label={`Copiar código ${justRedeemed.code}`}
              className="cc-focus-ring inline-flex items-center gap-2 rounded-cc-md bg-cc-soft px-4 py-2.5 font-mono text-[17px] font-black tracking-wider text-cc-text transition-colors hover:bg-cc-primary-soft hover:text-cc-primary"
            >
              {justRedeemed.code}
              <Copy className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
