import type { PaymentProvider } from "@cloudcommerce/types";
import type { SecretProbePort } from "../../application/settings-repository.js";

const providerEnvRequirements: Record<PaymentProvider, readonly string[]> = {
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  mercadopago: ["MP_ACCESS_TOKEN", "MP_WEBHOOK_SECRET"],
  modo: ["MODO_API_KEY"],
  offline: [],
};

export class EnvSecretProbe implements SecretProbePort {
  public constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  public async hasProviderSecrets(provider: PaymentProvider): Promise<boolean> {
    const required = providerEnvRequirements[provider];
    return required.every((key) => {
      const value = this.env[key];
      return typeof value === "string" && value.trim().length > 0;
    });
  }
}
