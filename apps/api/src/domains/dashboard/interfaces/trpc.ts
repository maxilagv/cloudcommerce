import {
  GetDashboardOverviewSchema,
  GetLowStockAlertsSchema,
  GetRecentActivitySchema,
  GetSalesByCategorySchema,
  GetSalesTimeSeriesSchema,
  GetTopCustomersSchema,
  GetTopProductsSchema,
} from "@cloudcommerce/validators";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";
import type { DashboardDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, dashboardErrorToAppError } from "../../../shared/errors/http-error.js";

const throwDashboard = (error: DashboardDomainError): never => {
  throw appErrorToTrpcError(dashboardErrorToAppError(error));
};

export const dashboardRouter = router({
  getOverview: adminProcedure.input(GetDashboardOverviewSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.dashboard.getOverview(ctx.actor, input);
    if (!result.ok) {
      return throwDashboard(result.error);
    }
    return result.value;
  }),

  getSalesTimeSeries: adminProcedure.input(GetSalesTimeSeriesSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.dashboard.getSalesTimeSeries(ctx.actor, input);
    if (!result.ok) {
      return throwDashboard(result.error);
    }
    return result.value;
  }),

  getSalesByCategory: adminProcedure.input(GetSalesByCategorySchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.dashboard.getSalesByCategory(ctx.actor, input);
    if (!result.ok) {
      return throwDashboard(result.error);
    }
    return result.value;
  }),

  getTopProducts: adminProcedure.input(GetTopProductsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.dashboard.getTopProducts(ctx.actor, input);
    if (!result.ok) {
      return throwDashboard(result.error);
    }
    return result.value;
  }),

  getTopCustomers: adminProcedure.input(GetTopCustomersSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.dashboard.getTopCustomers(ctx.actor, input);
    if (!result.ok) {
      return throwDashboard(result.error);
    }
    return result.value;
  }),

  getRecentActivity: adminProcedure.input(GetRecentActivitySchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.dashboard.getRecentActivity(ctx.actor, input);
    if (!result.ok) {
      return throwDashboard(result.error);
    }
    return result.value;
  }),

  getLowStockAlerts: adminProcedure.input(GetLowStockAlertsSchema).query(async ({ ctx, input }) => {
    const result = await ctx.container.dashboard.getLowStockAlerts(ctx.actor, input);
    if (!result.ok) {
      return throwDashboard(result.error);
    }
    return result.value;
  }),
});
