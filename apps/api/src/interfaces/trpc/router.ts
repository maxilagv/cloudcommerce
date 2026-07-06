import { aiRouter } from "../../domains/ai/interfaces/trpc.js";
import { catalogRouter } from "../../domains/catalog/interfaces/trpc.js";
import { storeRouter } from "../../domains/catalog/interfaces/store-trpc.js";
import { customersRouter } from "../../domains/customers/interfaces/trpc.js";
import { dashboardRouter } from "../../domains/dashboard/interfaces/trpc.js";
import { engagementRouter } from "../../domains/engagement/interfaces/trpc.js";
import { financeRouter } from "../../domains/finance/interfaces/trpc.js";
import { identityRouter } from "../../domains/identity/interfaces/trpc.js";
import { inventoryRouter } from "../../domains/inventory/interfaces/trpc.js";
import { loyaltyRouter } from "../../domains/loyalty/interfaces/trpc.js";
import { mediaRouter } from "../../domains/media/interfaces/trpc.js";
import { ordersRouter } from "../../domains/orders/interfaces/trpc.js";
import { pricingRouter } from "../../domains/pricing/interfaces/trpc.js";
import { settingsRouter } from "../../domains/settings/interfaces/trpc.js";
import { storefrontRouter } from "../../domains/storefront/interfaces/trpc.js";
import { suppliersRouter } from "../../domains/suppliers/interfaces/trpc.js";
import { router } from "./middleware/auth.js";

export const appRouter = router({
  identity: identityRouter,
  ai: aiRouter,
  catalog: catalogRouter,
  customers: customersRouter,
  dashboard: dashboardRouter,
  engagement: engagementRouter,
  media: mediaRouter,
  pricing: pricingRouter,
  inventory: inventoryRouter,
  orders: ordersRouter,
  finance: financeRouter,
  settings: settingsRouter,
  suppliers: suppliersRouter,
  store: storeRouter,
  storefront: storefrontRouter,
  loyalty: loyaltyRouter,
});

export type AppRouter = typeof appRouter;
