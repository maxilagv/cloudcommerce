import { z } from "zod";

export const DashboardRangeSchema = z.enum(["7d", "30d", "12m"]);

export const GetDashboardOverviewSchema = z.object({
  range: DashboardRangeSchema.default("30d"),
});

export const GetSalesTimeSeriesSchema = z.object({
  range: DashboardRangeSchema.default("30d"),
  metric: z.enum(["revenue", "income", "orders"]).default("revenue"),
});

export const GetSalesByCategorySchema = z.object({
  range: DashboardRangeSchema.default("30d"),
  limit: z.number().int().min(1).max(20).default(8),
  metric: z.enum(["revenue", "units"]).default("revenue"),
});

export const GetTopProductsSchema = z.object({
  range: DashboardRangeSchema.default("30d"),
  limit: z.number().int().min(1).max(20).default(5),
  metric: z.enum(["revenue", "units"]).default("revenue"),
});

export const GetTopCustomersSchema = z.object({
  range: DashboardRangeSchema.default("30d"),
  limit: z.number().int().min(1).max(20).default(5),
});

export const GetRecentActivitySchema = z.object({
  limit: z.number().int().min(1).max(20).default(10),
});

export const GetLowStockAlertsSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
  threshold: z.enum(["reorder_point", "zero"]).default("reorder_point"),
});

export type GetDashboardOverviewInput = z.infer<typeof GetDashboardOverviewSchema>;
export type GetSalesTimeSeriesInput = z.infer<typeof GetSalesTimeSeriesSchema>;
export type GetSalesByCategoryInput = z.infer<typeof GetSalesByCategorySchema>;
export type GetTopProductsInput = z.infer<typeof GetTopProductsSchema>;
export type GetTopCustomersInput = z.infer<typeof GetTopCustomersSchema>;
export type GetRecentActivityInput = z.infer<typeof GetRecentActivitySchema>;
export type GetLowStockAlertsInput = z.infer<typeof GetLowStockAlertsSchema>;
