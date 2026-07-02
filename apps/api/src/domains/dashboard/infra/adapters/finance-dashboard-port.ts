import type { Actor, Currency, DashboardRange, FinanceKpis } from "@cloudcommerce/types";
import type { Result } from "../../../../shared/domain/result.js";
import type { FinanceDomainError } from "../../../../shared/errors/domain-error.js";
import type { FinanceService } from "../../../finance/application/finance-service.js";
import type { DashboardFinancePort } from "../../application/ports.js";

export class FinanceDashboardPort implements DashboardFinancePort {
  public constructor(private readonly finance: FinanceService) {}

  public async getKpis(
    actor: Actor,
    input: { range: DashboardRange; currency: Currency },
  ): Promise<Result<FinanceKpis, FinanceDomainError>> {
    return this.finance.getKpis(actor, { range: toFinanceRange(input.range), currency: input.currency });
  }
}

const toFinanceRange = (range: DashboardRange): "last-30d" | "ytd" => {
  if (range === "12m") {
    return "ytd";
  }
  return "last-30d";
};
