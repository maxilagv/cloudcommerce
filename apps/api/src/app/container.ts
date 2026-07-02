import { StockStatus } from "@cloudcommerce/types";
import { InMemoryEventBus } from "../shared/events/event-bus.js";
import { createLogger } from "../shared/observability/logger.js";
import { createCacheClient } from "../infrastructure/cache/client.js";
import { createDatabaseClient } from "../infrastructure/database/client.js";
import { UnitOfWork } from "../infrastructure/database/unit-of-work.js";
import { DrizzleIdentityRepository } from "../domains/identity/infra/repositories/drizzle-identity-repository.js";
import { IdentityService } from "../domains/identity/application/services/identity-service.js";
import { DrizzleCatalogRepository } from "../domains/catalog/infra/repositories/drizzle-catalog-repository.js";
import { CatalogService } from "../domains/catalog/application/services/catalog-service.js";
import type { PriceReaderPort, StockReaderPort } from "../domains/catalog/application/ports/catalog-repository.js";
import { AiService } from "../domains/ai/application/ai-service.js";
import { SupplierService } from "../domains/suppliers/application/supplier-service.js";
import { DrizzleSupplierRepository } from "../domains/suppliers/infra/repositories/drizzle-supplier-repository.js";
import { AesApiConfigCipher } from "../domains/suppliers/infra/crypto/api-config-cipher.js";
import { RedisFeedLock } from "../domains/suppliers/infra/locks/redis-feed-lock.js";
import { DnsUrlGuard } from "../domains/suppliers/infra/integrations/dns-url-guard.js";
import { HttpFeedFetcher } from "../domains/suppliers/infra/integrations/http-feed-fetcher.js";
import { HttpSupplierForwarder } from "../domains/suppliers/infra/integrations/http-supplier-forwarder.js";
import {
  InventoryImportAdapter,
  OrdersIntegrationAdapter,
  PricingImportAdapter,
} from "../domains/suppliers/infra/adapters/domain-import-adapters.js";
import { OrdersForwardReadModel } from "../domains/suppliers/infra/read-models/orders-forward-read-model.js";
import { AiHttpGateway } from "../domains/ai/infra/http/ai-http-gateway.js";
import { DrizzleAiRepository } from "../domains/ai/infra/repositories/drizzle-ai-repository.js";
import { RedisAiRateLimiter } from "../domains/ai/infra/rate-limit/redis-ai-rate-limiter.js";
import { AiContextReadModel } from "../domains/ai/infra/read-models/ai-context-read-model.js";
import { DrizzleMediaRepository } from "../domains/media/infra/repositories/drizzle-media-repository.js";
import { LocalFsMediaStorage } from "../domains/media/infra/storage/local-fs-media-storage.js";
import { MediaService } from "../domains/media/application/services/media-service.js";
import { DrizzlePricingRepository } from "../domains/pricing/infra/repositories/drizzle-pricing-repository.js";
import { PricingService } from "../domains/pricing/application/pricing-service.js";
import { DrizzleInventoryRepository } from "../domains/inventory/infra/repositories/drizzle-inventory-repository.js";
import { InventoryService } from "../domains/inventory/application/inventory-service.js";
import { CustomerService } from "../domains/customers/application/customer-service.js";
import { DrizzleCustomerRepository } from "../domains/customers/infra/repositories/drizzle-customer-repository.js";
import { DrizzleOrderRepository } from "../domains/orders/infra/repositories/drizzle-order-repository.js";
import { PricingOrderPricingPort } from "../domains/orders/infra/pricing/pricing-order-pricing-port.js";
import { OrderService } from "../domains/orders/application/order-service.js";
import { OrdersCustomerAnalyticsReadModel } from "../domains/orders/infra/read-models/orders-customer-analytics-read-model.js";
import { OrdersFinanceReadModel } from "../domains/orders/infra/read-models/orders-finance-read-model.js";
import { DrizzleFinanceRepository } from "../domains/finance/infra/repositories/drizzle-finance-repository.js";
import { DeterministicDocumentRenderer } from "../domains/finance/infra/rendering/deterministic-document-renderer.js";
import { LocalDocumentStorage } from "../domains/finance/infra/storage/local-document-storage.js";
import { FinanceService } from "../domains/finance/application/finance-service.js";
import { DashboardCacheInvalidator } from "../domains/dashboard/application/dashboard-cache-invalidator.js";
import { DashboardService } from "../domains/dashboard/application/dashboard-service.js";
import { FinanceDashboardPort } from "../domains/dashboard/infra/adapters/finance-dashboard-port.js";
import { RedisDashboardCache } from "../domains/dashboard/infra/cache/redis-dashboard-cache.js";
import { DashboardCatalogReadModel } from "../domains/dashboard/infra/read-models/dashboard-catalog-read-model.js";
import { DashboardCustomersReadModel } from "../domains/dashboard/infra/read-models/dashboard-customers-read-model.js";
import { DashboardInventoryReadModel } from "../domains/dashboard/infra/read-models/dashboard-inventory-read-model.js";
import { DashboardOrdersReadModel } from "../domains/dashboard/infra/read-models/dashboard-orders-read-model.js";
import { SettingsService } from "../domains/settings/application/settings-service.js";
import { DrizzleSettingsRepository } from "../domains/settings/infra/repositories/drizzle-settings-repository.js";
import { EnvSecretProbe } from "../domains/settings/infra/secrets/env-secret-probe.js";
import type { AppConfig } from "./config.js";

export type AppContainer = ReturnType<typeof createContainer>;

export const createContainer = (config: AppConfig) => {
  const logger = createLogger(config.LOG_LEVEL);
  const database = createDatabaseClient(config.DATABASE_URL);
  const cache = createCacheClient(config.REDIS_URL);
  const unitOfWork = new UnitOfWork(database.db);
  const eventBus = new InMemoryEventBus();
  const identityRepository = new DrizzleIdentityRepository(database.db);
  const catalogRepository = new DrizzleCatalogRepository(database.db);
  const mediaRepository = new DrizzleMediaRepository(database.db);
  const pricingRepository = new DrizzlePricingRepository(database.db);
  const inventoryRepository = new DrizzleInventoryRepository(database.db);
  const customerRepository = new DrizzleCustomerRepository(database.db);
  const orderRepository = new DrizzleOrderRepository(database.db);
  const financeRepository = new DrizzleFinanceRepository(database.db);
  const settingsRepository = new DrizzleSettingsRepository(database.db);
  const mediaStorage = new LocalFsMediaStorage({
    root: config.STORAGE_LOCAL_ROOT,
    signedUrlSecret: config.COOKIE_SECRET,
  });
  const documentStorage = new LocalDocumentStorage(config.STORAGE_LOCAL_ROOT, config.COOKIE_SECRET);
  const pricing = new PricingService(pricingRepository);
  const inventory = new InventoryService(inventoryRepository);
  const orderPricing = new PricingOrderPricingPort(pricing);
  const ordersFinanceReadModel = new OrdersFinanceReadModel(database.db);
  const customerPurchaseAnalytics = new OrdersCustomerAnalyticsReadModel(database.db);
  const priceReader: PriceReaderPort = {
    getProductPrice: async (productId) => {
      const result = await pricing.getCatalogPriceByProductId(productId);
      return result.ok ? result.value : null;
    },
  };
  const stockReader: StockReaderPort = {
    getProductStockStatus: async (productId) => {
      const result = await inventory.getCatalogStockStatusByProductId(productId);
      return result.ok ? result.value : StockStatus.OUT_OF_STOCK;
    },
  };
  const identity = new IdentityService({
    repository: identityRepository,
    cache,
    unitOfWork,
    eventBus,
    logger,
    mfaSecretKey: config.COOKIE_SECRET,
  });
  const catalog = new CatalogService(catalogRepository, priceReader, stockReader);
  const ai = new AiService(
    new AiHttpGateway(config.AI_SERVICE_URL, config.AI_SERVICE_TOKEN),
    new DrizzleAiRepository(database.db),
    new RedisAiRateLimiter(cache),
    new AiContextReadModel(database.db),
    {
      perOperationLimitMinor: config.AI_OPERATION_COST_LIMIT_MINOR,
      dailyActorLimitMinor: config.AI_DAILY_ACTOR_COST_LIMIT_MINOR,
    },
  );
  const media = new MediaService(mediaRepository, mediaStorage, config.MEDIA_MAX_FILE_BYTES);
  const orders = new OrderService(orderRepository, orderPricing);
  const finance = new FinanceService(financeRepository, ordersFinanceReadModel, new DeterministicDocumentRenderer(), documentStorage, financeRepository);
  const customers = new CustomerService(customerRepository, customerPurchaseAnalytics);
  const settings = new SettingsService(settingsRepository, new EnvSecretProbe(process.env));
  const suppliers = new SupplierService(
    new DrizzleSupplierRepository(database.db),
    new AesApiConfigCipher(config.COOKIE_SECRET),
    new DnsUrlGuard(),
    new HttpFeedFetcher(),
    new HttpSupplierForwarder(),
    new RedisFeedLock(cache),
    new PricingImportAdapter(pricing),
    new InventoryImportAdapter(inventory),
    new OrdersIntegrationAdapter(new OrdersForwardReadModel(database.db), orders),
  );
  const dashboardCache = new RedisDashboardCache(cache);
  const dashboard = new DashboardService(
    new FinanceDashboardPort(finance),
    new DashboardOrdersReadModel(database.db),
    new DashboardInventoryReadModel(database.db),
    new DashboardCatalogReadModel(database.db),
    new DashboardCustomersReadModel(database.db),
    dashboardCache,
  );
  new DashboardCacheInvalidator(dashboardCache).register(eventBus);

  return {
    config,
    logger,
    database,
    cache,
    unitOfWork,
    eventBus,
    identity,
    catalog,
    ai,
    media,
    pricing,
    inventory,
    orders,
    finance,
    customers,
    suppliers,
    dashboard,
    settings,
    mediaStorage,
    documentStorage,
    close: async () => {
      await Promise.allSettled([cache.quit(), database.close()]);
    },
  };
};
