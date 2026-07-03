export const dashboardCacheTtlSeconds = {
  overview: 120,
  salesTimeSeries: 120,
  salesByCategory: 300,
  topProducts: 300,
  publishedCount: 600,
} as const;

export const dashboardCacheKey = {
  overview: (role: string, range: string): string => `dash:overview:${role}:${range}`,
  salesTimeSeries: (role: string, range: string, metric: string): string => `dash:series:${role}:${range}:${metric}`,
  salesByCategory: (role: string, range: string, metric: string, limit: number): string =>
    `dash:category:${role}:${range}:${metric}:${limit}`,
  topProducts: (role: string, range: string, limit: number, metric: string): string =>
    `dash:top-products:${role}:${range}:${limit}:${metric}`,
  publishedCount: (): string => "dash:published-count",
} as const;

export const dashboardInvalidationPrefixes = {
  ordersChanged: ["dash:overview:", "dash:series:", "dash:category:", "dash:top-products:"],
  financeChanged: ["dash:overview:", "dash:series:"],
  catalogChanged: ["dash:overview:", "dash:published-count", "dash:category:", "dash:top-products:"],
  customersChanged: ["dash:overview:"],
  stockChanged: ["dash:overview:"],
} as const;
