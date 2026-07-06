"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Flag, Plus, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AdminRole,
  ShippingMethod,
  type FeatureFlag,
  type PaymentMethodConfig,
  type SettingKey,
  type SettingRecord,
  type ShippingCoverageSettings,
  type ShippingOptionConfig,
  type StoreBillingSettings,
  type StoreCurrencySettings,
  type StoreIdentitySettings,
  type StoreSocialSettings,
} from "@cloudcommerce/types";
import { Badge, Button, Dialog, DialogClose, DialogContent, Select, Skeleton, Switch, useToast } from "@cloudcommerce/ui";
import { trpc } from "@/lib/trpc";
import { formatMinor } from "@/lib/format";

type TabKey = "general" | "billing" | "social" | "shipping" | "payments" | "flags";
type ShippingDraft = ShippingOptionConfig & { reason?: string };
type FlagDraft = {
  key: string;
  enabled: boolean;
  owner: string;
  reviewAt: string;
  removalPlan: string;
  isTemporary: boolean;
  description: string;
  reason: string;
};

const SETTINGS_KEYS: SettingKey[] = [
  "store.identity",
  "store.currency",
  "store.billing",
  "store.social",
  "shipping.coverage",
];

const TAB_OPTIONS: { key: TabKey; label: string }[] = [
  { key: "general", label: "General" },
  { key: "billing", label: "Facturacion" },
  { key: "social", label: "Redes" },
  { key: "shipping", label: "Envios" },
  { key: "payments", label: "Pagos" },
  { key: "flags", label: "Flags" },
];

const SHIPPING_METHOD_OPTIONS = [
  { value: ShippingMethod.STANDARD, label: "Estandar" },
  { value: ShippingMethod.EXPRESS, label: "Express" },
  { value: ShippingMethod.PICKUP, label: "Retiro" },
];

const ROUNDING_OPTIONS = [
  { value: "none", label: "Sin redondeo" },
  { value: "nearest_100", label: "Redondear a $100" },
  { value: "nearest_1000", label: "Redondear a $1.000" },
];

const DEFAULT_IDENTITY: StoreIdentitySettings = { name: "", legalName: "", cuit: "", logoAssetId: "" };
const DEFAULT_CURRENCY: StoreCurrencySettings = { base: "ARS", display: "es-AR", rounding: "nearest_100" };
const DEFAULT_BILLING: StoreBillingSettings = {
  legalName: "",
  cuit: "",
  ivaCondition: "",
  fiscalAddress: "",
  salesPoint: "",
};
const DEFAULT_SOCIAL: StoreSocialSettings = { instagram: "", facebook: "", whatsapp: "", tiktok: "", x: "" };
const DEFAULT_COVERAGE: ShippingCoverageSettings = { provinces: ["Buenos Aires"], cities: ["CABA"], defaultCity: "CABA" };

function settingValue<T>(settings: SettingRecord[] | undefined, key: SettingKey, fallback: T): T {
  return (settings?.find((s) => s.key === key)?.value as T | undefined) ?? fallback;
}

function optional(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function moneyToMinor(value: string): number {
  return Math.max(0, Math.round(Number(value || "0") * 100));
}

function providerLabel(provider: PaymentMethodConfig["provider"]): string {
  const labels: Record<PaymentMethodConfig["provider"], string> = {
    stripe: "Stripe",
    mercadopago: "Mercado Pago",
    modo: "MODO",
    offline: "Offline",
  };
  return labels[provider];
}

function todayPlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function emptyShippingDraft(position: number): ShippingDraft {
  return {
    id: "",
    method: ShippingMethod.STANDARD,
    label: "",
    detail: "",
    costAmountMinor: 0,
    currency: "ARS",
    isActive: true,
    isDefault: false,
    position,
    reason: "",
  };
}

function emptyFlagDraft(): FlagDraft {
  return {
    key: "",
    enabled: false,
    owner: "",
    reviewAt: todayPlus(30),
    removalPlan: "",
    isTemporary: false,
    description: "",
    reason: "",
  };
}

export default function StoreSettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("general");
  const [identity, setIdentity] = useState<StoreIdentitySettings>(DEFAULT_IDENTITY);
  const [currency, setCurrency] = useState<StoreCurrencySettings>(DEFAULT_CURRENCY);
  const [billing, setBilling] = useState<StoreBillingSettings>(DEFAULT_BILLING);
  const [social, setSocial] = useState<StoreSocialSettings>(DEFAULT_SOCIAL);
  const [coverage, setCoverage] = useState({ provinces: "", cities: "", defaultCity: "" });
  const [shippingDraft, setShippingDraft] = useState<ShippingDraft | null>(null);
  const [flagDraft, setFlagDraft] = useState<FlagDraft | null>(null);

  const me = useQuery({ queryKey: ["identity", "me"], queryFn: () => trpc.identity.me.query(), retry: false });
  const settings = useQuery({
    queryKey: ["settings", "records", SETTINGS_KEYS],
    queryFn: () => trpc.settings.getSettings.query({ keys: SETTINGS_KEYS }),
  });
  const shippingOptions = useQuery({
    queryKey: ["settings", "shipping-options", true],
    queryFn: () => trpc.settings.listShippingOptions.query({ includeInactive: true }),
  });
  const paymentMethods = useQuery({
    queryKey: ["settings", "payment-methods", true],
    queryFn: () => trpc.settings.listPaymentMethods.query({ includeDisabled: true }),
  });
  const featureFlags = useQuery({
    queryKey: ["settings", "feature-flags"],
    queryFn: () => trpc.settings.listFeatureFlags.query({}),
  });

  const isOwner = me.data?.profile.role === AdminRole.OWNER;

  useEffect(() => {
    setIdentity(settingValue(settings.data, "store.identity", DEFAULT_IDENTITY));
    setCurrency(settingValue(settings.data, "store.currency", DEFAULT_CURRENCY));
    setBilling(settingValue(settings.data, "store.billing", DEFAULT_BILLING));
    setSocial(settingValue(settings.data, "store.social", DEFAULT_SOCIAL));
    const currentCoverage = settingValue(settings.data, "shipping.coverage", DEFAULT_COVERAGE);
    setCoverage({
      provinces: currentCoverage.provinces.join("\n"),
      cities: currentCoverage.cities.join("\n"),
      defaultCity: currentCoverage.defaultCity,
    });
  }, [settings.data]);

  const updateSetting = useMutation({
    mutationFn: (input: { key: SettingKey; value: unknown; reason?: string }) => trpc.settings.updateSetting.mutate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "records"] });
      toast({ tone: "success", title: "Configuracion guardada" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo guardar", message: err instanceof Error ? err.message : "Revisa los datos." }),
  });

  const upsertShipping = useMutation({
    mutationFn: (input: ShippingDraft) =>
      trpc.settings.upsertShippingOption.mutate({
        id: input.id.trim(),
        method: input.method,
        label: input.label.trim(),
        detail: input.detail.trim(),
        costAmountMinor: input.costAmountMinor,
        currency: "ARS",
        isActive: input.isActive,
        isDefault: input.isDefault,
        position: input.position,
        ...(optional(input.reason ?? "") ? { reason: optional(input.reason ?? "") } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "shipping-options"] });
      toast({ tone: "success", title: "Metodo de envio guardado" });
      setShippingDraft(null);
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo guardar envio", message: err instanceof Error ? err.message : "Revisa los datos." }),
  });

  const togglePayment = useMutation({
    mutationFn: (input: { id: PaymentMethodConfig["id"]; isEnabled: boolean }) => trpc.settings.togglePaymentMethod.mutate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "payment-methods"] });
      toast({ tone: "success", title: "Metodo de pago actualizado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo actualizar pago", message: err instanceof Error ? err.message : "Intentelo de nuevo." }),
  });

  const toggleFlag = useMutation({
    mutationFn: (input: { key: string; enabled: boolean }) => trpc.settings.toggleFeatureFlag.mutate(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "feature-flags"] });
      toast({ tone: "success", title: "Feature flag actualizado" });
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo actualizar flag", message: err instanceof Error ? err.message : "Intentelo de nuevo." }),
  });

  const upsertFlag = useMutation({
    mutationFn: (input: FlagDraft) =>
      trpc.settings.upsertFeatureFlag.mutate({
        key: input.key.trim(),
        enabled: input.enabled,
        owner: input.owner.trim(),
        reviewAt: input.reviewAt,
        isTemporary: input.isTemporary,
        description: input.description.trim(),
        ...(input.isTemporary ? { removalPlan: input.removalPlan.trim() } : {}),
        ...(optional(input.reason) ? { reason: optional(input.reason) } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings", "feature-flags"] });
      toast({ tone: "success", title: "Feature flag guardado" });
      setFlagDraft(null);
    },
    onError: (err) => toast({ tone: "error", title: "No se pudo guardar flag", message: err instanceof Error ? err.message : "Revisa los datos." }),
  });

  const sortedShipping = useMemo(
    () => [...(shippingOptions.data ?? [])].sort((a, b) => a.position - b.position),
    [shippingOptions.data],
  );
  const sortedPayments = useMemo(
    () => [...(paymentMethods.data ?? [])].sort((a, b) => a.position - b.position),
    [paymentMethods.data],
  );

  function saveIdentity() {
    updateSetting.mutate({
      key: "store.identity",
      value: {
        name: identity.name.trim(),
        ...(optional(identity.legalName ?? "") ? { legalName: optional(identity.legalName ?? "") } : {}),
        ...(optional(identity.cuit ?? "") ? { cuit: optional(identity.cuit ?? "") } : {}),
        ...(optional(identity.logoAssetId ?? "") ? { logoAssetId: optional(identity.logoAssetId ?? "") } : {}),
      },
    });
  }

  function saveCurrency() {
    updateSetting.mutate({ key: "store.currency", value: { ...currency, base: "ARS" } });
  }

  function saveBilling() {
    updateSetting.mutate({
      key: "store.billing",
      value: {
        legalName: billing.legalName.trim(),
        cuit: billing.cuit.trim(),
        ivaCondition: billing.ivaCondition.trim(),
        fiscalAddress: billing.fiscalAddress.trim(),
        ...(optional(billing.salesPoint ?? "") ? { salesPoint: optional(billing.salesPoint ?? "") } : {}),
      },
    });
  }

  function saveSocial() {
    updateSetting.mutate({
      key: "store.social",
      value: {
        ...(optional(social.instagram ?? "") ? { instagram: optional(social.instagram ?? "") } : {}),
        ...(optional(social.facebook ?? "") ? { facebook: optional(social.facebook ?? "") } : {}),
        ...(optional(social.whatsapp ?? "") ? { whatsapp: optional(social.whatsapp ?? "") } : {}),
        ...(optional(social.tiktok ?? "") ? { tiktok: optional(social.tiktok ?? "") } : {}),
        ...(optional(social.x ?? "") ? { x: optional(social.x ?? "") } : {}),
      },
    });
  }

  function saveCoverage() {
    updateSetting.mutate({
      key: "shipping.coverage",
      value: {
        provinces: splitLines(coverage.provinces),
        cities: splitLines(coverage.cities),
        defaultCity: coverage.defaultCity.trim(),
      },
    });
  }

  const flagCanSubmit =
    flagDraft !== null &&
    flagDraft.key.trim().length > 0 &&
    flagDraft.owner.trim().length > 0 &&
    flagDraft.reviewAt.length > 0 &&
    flagDraft.description.trim().length > 0 &&
    (!flagDraft.isTemporary || flagDraft.removalPlan.trim().length > 0);

  return (
    <div className="admin-view">
      <div className="admin-ph">
        <div>
          <h1>Tienda y pagos</h1>
          <div className="admin-ph__sub">Configuracion operativa de storefront, checkout, envios y flags.</div>
        </div>
      </div>

      <div className="admin-segs" style={{ width: "fit-content", marginBottom: 18 }}>
        {TAB_OPTIONS.map((item) => (
          <button key={item.key} data-on={tab === item.key || undefined} onClick={() => setTab(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      {settings.isLoading ? (
        <div style={{ display: "grid", gap: 12 }}>
          <Skeleton height={150} radius={14} />
          <Skeleton height={150} radius={14} />
        </div>
      ) : (
        <>
          {tab === "general" && (
            <div className="admin-detail-grid">
              <section className="admin-panel">
                <div className="admin-panel__h">
                  <h3>Identidad publica</h3>
                  <Button size="sm" variant="primary" loading={updateSetting.isPending} onClick={saveIdentity}>
                    Guardar
                  </Button>
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  <label className="admin-form-g">
                    <span>Nombre de tienda</span>
                    <input className="ui-input" value={identity.name} onChange={(e) => setIdentity({ ...identity, name: e.target.value })} />
                  </label>
                  <label className="admin-form-g">
                    <span>Razon social publica</span>
                    <input className="ui-input" value={identity.legalName ?? ""} onChange={(e) => setIdentity({ ...identity, legalName: e.target.value })} />
                  </label>
                  <label className="admin-form-g">
                    <span>CUIT</span>
                    <input className="ui-input admin-mono" placeholder="30-12345678-9" value={identity.cuit ?? ""} onChange={(e) => setIdentity({ ...identity, cuit: e.target.value })} />
                  </label>
                  <label className="admin-form-g">
                    <span>Logo asset ID</span>
                    <input className="ui-input admin-mono" value={identity.logoAssetId ?? ""} onChange={(e) => setIdentity({ ...identity, logoAssetId: e.target.value })} />
                  </label>
                </div>
              </section>

              <section className="admin-panel">
                <div className="admin-panel__h">
                  <h3>Moneda</h3>
                  {isOwner ? (
                    <Button size="sm" variant="primary" loading={updateSetting.isPending} onClick={saveCurrency}>
                      Guardar
                    </Button>
                  ) : (
                    <Badge tone="muted">Solo OWNER</Badge>
                  )}
                </div>
                <div style={{ display: "grid", gap: 14 }}>
                  <label className="admin-form-g">
                    <span>Moneda base</span>
                    <input className="ui-input admin-mono" value="ARS" disabled />
                  </label>
                  <label className="admin-form-g">
                    <span>Display locale</span>
                    <input className="ui-input" value={currency.display} disabled={!isOwner} onChange={(e) => setCurrency({ ...currency, display: e.target.value })} />
                  </label>
                  <label className="admin-form-g">
                    <span>Redondeo</span>
                    <Select
                      options={ROUNDING_OPTIONS}
                      value={currency.rounding}
                      disabled={!isOwner}
                      onChange={(e) => setCurrency({ ...currency, rounding: e.target.value as StoreCurrencySettings["rounding"] })}
                    />
                  </label>
                </div>
              </section>
            </div>
          )}

          {tab === "billing" && (
            <section className="admin-panel">
              <div className="admin-panel__h">
                <h3>Facturacion</h3>
                {isOwner ? (
                  <Button size="sm" variant="primary" loading={updateSetting.isPending} onClick={saveBilling}>
                    Guardar
                  </Button>
                ) : (
                  <Badge tone="muted">Solo OWNER</Badge>
                )}
              </div>
              <div className="admin-grid admin-grid--2">
                <label className="admin-form-g">
                  <span>Razon social</span>
                  <input className="ui-input" disabled={!isOwner} value={billing.legalName} onChange={(e) => setBilling({ ...billing, legalName: e.target.value })} />
                </label>
                <label className="admin-form-g">
                  <span>CUIT</span>
                  <input className="ui-input admin-mono" disabled={!isOwner} value={billing.cuit} onChange={(e) => setBilling({ ...billing, cuit: e.target.value })} />
                </label>
                <label className="admin-form-g">
                  <span>Condicion IVA</span>
                  <input className="ui-input" disabled={!isOwner} value={billing.ivaCondition} onChange={(e) => setBilling({ ...billing, ivaCondition: e.target.value })} />
                </label>
                <label className="admin-form-g">
                  <span>Punto de venta</span>
                  <input className="ui-input admin-mono" disabled={!isOwner} value={billing.salesPoint ?? ""} onChange={(e) => setBilling({ ...billing, salesPoint: e.target.value })} />
                </label>
                <label className="admin-form-g" style={{ gridColumn: "1 / -1" }}>
                  <span>Domicilio fiscal</span>
                  <textarea className="ui-input" rows={3} disabled={!isOwner} value={billing.fiscalAddress} onChange={(e) => setBilling({ ...billing, fiscalAddress: e.target.value })} />
                </label>
              </div>
            </section>
          )}

          {tab === "social" && (
            <section className="admin-panel">
              <div className="admin-panel__h">
                <h3>Redes y contacto</h3>
                <Button size="sm" variant="primary" loading={updateSetting.isPending} onClick={saveSocial}>
                  Guardar
                </Button>
              </div>
              <div className="admin-grid admin-grid--2">
                {(["instagram", "facebook", "whatsapp", "tiktok", "x"] as const).map((key) => (
                  <label key={key} className="admin-form-g">
                    <span>{key}</span>
                    <input className="ui-input" value={social[key] ?? ""} onChange={(e) => setSocial({ ...social, [key]: e.target.value })} />
                  </label>
                ))}
              </div>
            </section>
          )}

          {tab === "shipping" && (
            <div style={{ display: "grid", gap: 16 }}>
              <section className="admin-tbl-card">
                <div className="admin-toolbar">
                  <Truck size={16} />
                  <span style={{ fontWeight: 650 }}>Metodos de envio</span>
                  <span style={{ flex: 1 }} />
                  <Button size="sm" variant="primary" onClick={() => setShippingDraft(emptyShippingDraft(sortedShipping.length))}>
                    <Plus size={15} /> Nuevo metodo
                  </Button>
                </div>
                <div style={{ padding: 16, display: "grid", gap: 10 }}>
                  {shippingOptions.isLoading ? (
                    <Skeleton height={72} radius={14} />
                  ) : sortedShipping.length === 0 ? (
                    <div className="admin-empty">
                      <Truck size={38} />
                      <h4>Sin metodos de envio</h4>
                    </div>
                  ) : (
                    sortedShipping.map((option) => (
                      <div key={option.id} className="admin-session" style={{ marginBottom: 0 }}>
                        <span className="admin-session__ic">
                          <Truck size={17} />
                        </span>
                        <div className="admin-session__info">
                          <div className="admin-session__t">{option.label}</div>
                          <div className="admin-session__m admin-mono">
                            {option.id} - {option.method} - {formatMinor(option.costAmountMinor)}
                          </div>
                        </div>
                        {option.isDefault && <Badge tone="info">Default</Badge>}
                        <Badge tone={option.isActive ? "success" : "muted"}>{option.isActive ? "Activo" : "Inactivo"}</Badge>
                        <Button size="sm" variant="outline" onClick={() => setShippingDraft({ ...option, reason: "" })}>
                          Editar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="admin-panel">
                <div className="admin-panel__h">
                  <h3>Cobertura</h3>
                  <Button size="sm" variant="primary" loading={updateSetting.isPending} onClick={saveCoverage}>
                    Guardar
                  </Button>
                </div>
                <div className="admin-grid admin-grid--2">
                  <label className="admin-form-g">
                    <span>Provincias</span>
                    <textarea className="ui-input" rows={6} value={coverage.provinces} onChange={(e) => setCoverage({ ...coverage, provinces: e.target.value })} />
                  </label>
                  <label className="admin-form-g">
                    <span>Ciudades</span>
                    <textarea className="ui-input" rows={6} value={coverage.cities} onChange={(e) => setCoverage({ ...coverage, cities: e.target.value })} />
                  </label>
                  <label className="admin-form-g">
                    <span>Ciudad default</span>
                    <input className="ui-input" value={coverage.defaultCity} onChange={(e) => setCoverage({ ...coverage, defaultCity: e.target.value })} />
                  </label>
                </div>
              </section>
            </div>
          )}

          {tab === "payments" && (
            <section className="admin-tbl-card">
              <div className="admin-toolbar">
                <CreditCard size={16} />
                <span style={{ fontWeight: 650 }}>Metodos de pago</span>
              </div>
              <div style={{ padding: 16, display: "grid", gap: 10 }}>
                {paymentMethods.isLoading ? (
                  <Skeleton height={72} radius={14} />
                ) : sortedPayments.length === 0 ? (
                  <div className="admin-empty">
                    <CreditCard size={38} />
                    <h4>Sin metodos de pago</h4>
                  </div>
                ) : (
                  sortedPayments.map((method) => (
                    <div key={method.id} className="admin-session" style={{ marginBottom: 0 }}>
                      <span className="admin-session__ic">
                        <CreditCard size={17} />
                      </span>
                      <div className="admin-session__info">
                        <div className="admin-session__t">{method.label}</div>
                        <div className="admin-session__m admin-mono">
                          {method.id} - {providerLabel(method.provider)}
                          {typeof method.installmentsMax === "number" ? ` - ${method.installmentsMax} cuotas` : ""}
                        </div>
                      </div>
                      <Badge tone={method.credentialsRef ? "success" : "warning"}>
                        {method.credentialsRef ? "Credencial configurada" : "Sin credencial"}
                      </Badge>
                      <Switch checked={method.isEnabled} onCheckedChange={(checked) => togglePayment.mutate({ id: method.id, isEnabled: checked })} />
                    </div>
                  ))
                )}
              </div>
            </section>
          )}

          {tab === "flags" && (
            <section className="admin-tbl-card">
              <div className="admin-toolbar">
                <Flag size={16} />
                <span style={{ fontWeight: 650 }}>Feature flags</span>
                <span style={{ flex: 1 }} />
                <Button size="sm" variant="primary" onClick={() => setFlagDraft(emptyFlagDraft())}>
                  <Plus size={15} /> Nuevo flag
                </Button>
              </div>
              <div style={{ padding: 16, display: "grid", gap: 10 }}>
                {featureFlags.isLoading ? (
                  <Skeleton height={72} radius={14} />
                ) : !featureFlags.data || featureFlags.data.items.length === 0 ? (
                  <div className="admin-empty">
                    <Flag size={38} />
                    <h4>Sin feature flags</h4>
                  </div>
                ) : (
                  featureFlags.data.items.map((flag) => (
                    <div key={flag.key} className="admin-session" style={{ marginBottom: 0 }}>
                      <span className="admin-session__ic">
                        <Flag size={17} />
                      </span>
                      <div className="admin-session__info">
                        <div className="admin-session__t">{flag.key}</div>
                        <div className="admin-session__m">{flag.description}</div>
                        <div className="admin-session__m admin-mono">owner: {flag.owner} - review: {flag.reviewAt}</div>
                      </div>
                      {flag.removalPlan && <Badge tone="warning">Temporal</Badge>}
                      <Switch checked={flag.enabled} onCheckedChange={(checked) => toggleFlag.mutate({ key: flag.key, enabled: checked })} />
                      <Button size="sm" variant="outline" onClick={() => setFlagDraft(flagToDraft(flag))}>
                        Editar
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </>
      )}

      <Dialog open={shippingDraft !== null} onOpenChange={(open) => !open && setShippingDraft(null)}>
        <DialogContent
          title={shippingDraft?.id ? "Editar envio" : "Nuevo envio"}
          description="El costo se guarda en pesos argentinos y se aplica desde el backend."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button
                variant="primary"
                loading={upsertShipping.isPending}
                disabled={!shippingDraft?.id.trim() || !shippingDraft?.label.trim()}
                onClick={() => shippingDraft && upsertShipping.mutate(shippingDraft)}
              >
                Guardar envio
              </Button>
            </>
          }
        >
          {shippingDraft && (
            <div style={{ display: "grid", gap: 14 }}>
              <label className="admin-form-g">
                <span>ID</span>
                <input className="ui-input admin-mono" value={shippingDraft.id} onChange={(e) => setShippingDraft({ ...shippingDraft, id: e.target.value })} placeholder="standard-ba" />
              </label>
              <label className="admin-form-g">
                <span>Metodo</span>
                <Select options={SHIPPING_METHOD_OPTIONS} value={shippingDraft.method} onChange={(e) => setShippingDraft({ ...shippingDraft, method: e.target.value as ShippingMethod })} />
              </label>
              <label className="admin-form-g">
                <span>Label</span>
                <input className="ui-input" value={shippingDraft.label} onChange={(e) => setShippingDraft({ ...shippingDraft, label: e.target.value })} />
              </label>
              <label className="admin-form-g">
                <span>Detalle</span>
                <input className="ui-input" value={shippingDraft.detail} onChange={(e) => setShippingDraft({ ...shippingDraft, detail: e.target.value })} />
              </label>
              <label className="admin-form-g">
                <span>Costo ARS</span>
                <input
                  className="ui-input admin-mono"
                  type="number"
                  min={0}
                  value={Math.round(shippingDraft.costAmountMinor / 100)}
                  onChange={(e) => setShippingDraft({ ...shippingDraft, costAmountMinor: moneyToMinor(e.target.value) })}
                />
              </label>
              <label className="admin-form-g">
                <span>Posicion</span>
                <input className="ui-input admin-mono" type="number" min={0} value={shippingDraft.position} onChange={(e) => setShippingDraft({ ...shippingDraft, position: Number(e.target.value) })} />
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <Switch checked={shippingDraft.isActive} onCheckedChange={(checked) => setShippingDraft({ ...shippingDraft, isActive: checked })} />
                  Activo
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <Switch checked={shippingDraft.isDefault} onCheckedChange={(checked) => setShippingDraft({ ...shippingDraft, isDefault: checked })} />
                  Default
                </label>
              </div>
              <label className="admin-form-g">
                <span>Motivo (opcional)</span>
                <textarea className="ui-input" rows={3} value={shippingDraft.reason ?? ""} onChange={(e) => setShippingDraft({ ...shippingDraft, reason: e.target.value })} />
              </label>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={flagDraft !== null} onOpenChange={(open) => !open && setFlagDraft(null)}>
        <DialogContent
          title={flagDraft?.key ? "Editar feature flag" : "Nuevo feature flag"}
          description="Los flags temporales requieren plan de retiro antes de guardarse."
          footer={
            <>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button variant="primary" loading={upsertFlag.isPending} disabled={!flagCanSubmit} onClick={() => flagDraft && upsertFlag.mutate(flagDraft)}>
                Guardar flag
              </Button>
            </>
          }
        >
          {flagDraft && (
            <div style={{ display: "grid", gap: 14 }}>
              <label className="admin-form-g">
                <span>Key</span>
                <input className="ui-input admin-mono" value={flagDraft.key} onChange={(e) => setFlagDraft({ ...flagDraft, key: e.target.value })} placeholder="checkout.new-flow" />
              </label>
              <label className="admin-form-g">
                <span>Owner</span>
                <input className="ui-input" value={flagDraft.owner} onChange={(e) => setFlagDraft({ ...flagDraft, owner: e.target.value })} />
              </label>
              <label className="admin-form-g">
                <span>Review at</span>
                <input className="ui-input admin-mono" type="date" value={flagDraft.reviewAt} onChange={(e) => setFlagDraft({ ...flagDraft, reviewAt: e.target.value })} />
              </label>
              <label className="admin-form-g">
                <span>Descripcion</span>
                <textarea className="ui-input" rows={3} value={flagDraft.description} onChange={(e) => setFlagDraft({ ...flagDraft, description: e.target.value })} />
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <Switch checked={flagDraft.enabled} onCheckedChange={(checked) => setFlagDraft({ ...flagDraft, enabled: checked })} />
                  Habilitado
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <Switch checked={flagDraft.isTemporary} onCheckedChange={(checked) => setFlagDraft({ ...flagDraft, isTemporary: checked })} />
                  Temporal
                </label>
              </div>
              {flagDraft.isTemporary && (
                <label className="admin-form-g">
                  <span>Plan de retiro requerido</span>
                  <textarea className="ui-input" rows={3} value={flagDraft.removalPlan} onChange={(e) => setFlagDraft({ ...flagDraft, removalPlan: e.target.value })} />
                </label>
              )}
              <label className="admin-form-g">
                <span>Motivo (opcional)</span>
                <textarea className="ui-input" rows={2} value={flagDraft.reason} onChange={(e) => setFlagDraft({ ...flagDraft, reason: e.target.value })} />
              </label>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function flagToDraft(flag: FeatureFlag): FlagDraft {
  return {
    key: flag.key,
    enabled: flag.enabled,
    owner: flag.owner,
    reviewAt: flag.reviewAt.slice(0, 10),
    removalPlan: flag.removalPlan ?? "",
    isTemporary: Boolean(flag.removalPlan),
    description: flag.description,
    reason: "",
  };
}
