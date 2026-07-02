import { AdminRole, MediaSource, ProductStatus, StockStatus } from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import { CatalogService, PlaceholderPriceReader } from "../../application/services/catalog-service.js";
import type {
  CatalogRepository,
  CreateBrandRecord,
  CreateCategoryRecord,
  CreateProductRecord,
  PriceReaderPort,
  CreateVariantRecord,
  ProductSearchFilters,
  ProductSearchResult,
  ReplaceProductMediaRecord,
  ReplaceSpecGroupRecord,
  StockReaderPort,
  UpdateBrandRecord,
  UpdateCategoryRecord,
  UpdateProductRecord,
  UpdateVariantRecord,
} from "../../application/ports/catalog-repository.js";
import type {
  BrandEntity,
  CategoryEntity,
  MediaAssetEntity,
  ProductAggregate,
  ProductEntity,
  ProductMediaEntity,
  ProductVariantEntity,
  SpecGroupEntity,
} from "../../domain/entities/catalog-entities.js";

const now = new Date("2026-07-01T00:00:00.000Z");
const productId = "44444444-4444-4444-8444-444444444444";

describe("CatalogService", () => {
  it("rejects catalog writes for SUPPORT", async () => {
    const service = newService(new FakeCatalogRepository());

    const result = await service.createProduct(
      { kind: "admin", userId: "support", role: AdminRole.SUPPORT, sessionId: "session" },
      {
        slug: "blocked-product",
        title: "Blocked Product",
        description: "Descripcion suficiente para intentar crear producto.",
        categoryId: "11111111-1111-4111-8111-111111111114",
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("FORBIDDEN");
    }
  });

  it("rejects product media replacement outside the 1..6 cardinality", async () => {
    const service = newService(new FakeCatalogRepository());

    const result = await service.replaceProductMedia(
      { kind: "admin", userId: "owner", role: AdminRole.OWNER, sessionId: "session" },
      {
        productId,
        mainImageId: "33333333-3333-4333-8333-333333333331",
        media: Array.from({ length: 7 }, (_, index) => ({
          mediaAssetId: `33333333-3333-4333-8333-33333333333${index + 1}`,
          position: index,
        })),
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("PRODUCT_MEDIA_CARDINALITY_INVALID");
    }
  });

  it("uses pricing and inventory ports for product cards", async () => {
    const service = newService(
      new FakeCatalogRepository([productAggregate]),
      new FixedPriceReader(),
      new FixedStockReader(StockStatus.IN_STOCK),
    );

    const result = await service.searchProducts(
      { kind: "admin", userId: "owner", role: AdminRole.OWNER, sessionId: "session" },
      { limit: 10, sort: "created_desc" },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.items[0]?.price).toEqual({ amountMinor: 123_456, currency: "ARS" });
      expect(result.value.items[0]?.compareAtPrice).toEqual({ amountMinor: 150_000, currency: "ARS" });
      expect(result.value.items[0]?.stockStatus).toBe(StockStatus.IN_STOCK);
    }
  });

  it("public search always forces PUBLISHED status", async () => {
    class CapturingRepository extends FakeCatalogRepository {
      public capturedFilters: ProductSearchFilters | null = null;

      public override async searchProducts(filters: ProductSearchFilters): Promise<ProductSearchResult> {
        this.capturedFilters = filters;
        return super.searchProducts(filters);
      }
    }
    const repository = new CapturingRepository([]);
    const service = newService(repository);

    const result = await service.publicSearchProducts({ limit: 24, sort: "created_desc", query: "lavarropas" });

    expect(result.ok).toBe(true);
    expect(repository.capturedFilters?.status).toBe(ProductStatus.PUBLISHED);
  });

  it("public product detail hides non-published products", async () => {
    class DraftSlugRepository extends FakeCatalogRepository {
      public override async findProductBySlug(_slug: string): Promise<ProductAggregate | null> {
        return productAggregate;
      }
    }
    const service = newService(new DraftSlugRepository());

    const result = await service.publicGetProductBySlug("cualquier-slug");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("PRODUCT_NOT_FOUND");
    }
  });
});

class UnknownStockReader {
  public async getProductStockStatus(_productId: string): Promise<StockStatus> {
    return StockStatus.OUT_OF_STOCK;
  }
}

class FixedPriceReader implements PriceReaderPort {
  public async getProductPrice(_productId: string): Promise<{ salePriceMinor: number; compareAtPriceMinor: number | null; currency: "ARS" }> {
    return { salePriceMinor: 123_456, compareAtPriceMinor: 150_000, currency: "ARS" };
  }
}

class FixedStockReader implements StockReaderPort {
  public constructor(private readonly status: StockStatus) {}

  public async getProductStockStatus(_productId: string): Promise<StockStatus> {
    return this.status;
  }
}

const newService = (
  repository: CatalogRepository,
  priceReader: PriceReaderPort = new PlaceholderPriceReader(),
  stockReader: StockReaderPort = new UnknownStockReader(),
): CatalogService => new CatalogService(repository, priceReader, stockReader);

class FakeCatalogRepository implements CatalogRepository {
  public constructor(private readonly searchItems: ProductAggregate[] = []) {}

  public async listCategories(_includeInactive: boolean): Promise<CategoryEntity[]> {
    return [];
  }

  public async findCategoryById(id: string): Promise<CategoryEntity | null> {
    return id === "11111111-1111-4111-8111-111111111114"
      ? {
          id,
          parentId: null,
          name: "Celulares",
          slug: "celulares",
          description: null,
          imageId: null,
          position: 0,
          isActive: true,
          seoTitle: null,
          seoDescription: null,
          createdAt: now,
          updatedAt: now,
        }
      : null;
  }

  public async findCategoryByParentAndSlug(_parentId: string | null, _slug: string): Promise<CategoryEntity | null> {
    return null;
  }

  public async createCategory(_input: CreateCategoryRecord): Promise<CategoryEntity> {
    throw new Error("unexpected");
  }

  public async updateCategory(_input: UpdateCategoryRecord): Promise<CategoryEntity | null> {
    throw new Error("unexpected");
  }

  public async listBrands(_includeInactive: boolean): Promise<BrandEntity[]> {
    return [];
  }

  public async findBrandById(_id: string): Promise<BrandEntity | null> {
    return null;
  }

  public async findBrandBySlug(_slug: string): Promise<BrandEntity | null> {
    return null;
  }

  public async createBrand(_input: CreateBrandRecord): Promise<BrandEntity> {
    throw new Error("unexpected");
  }

  public async updateBrand(_input: UpdateBrandRecord): Promise<BrandEntity | null> {
    throw new Error("unexpected");
  }

  public async findMediaAssetById(id: string): Promise<MediaAssetEntity | null> {
    return {
      id,
      storageKey: "test.png",
      mime: "image/png",
      byteSize: 68,
      width: 1,
      height: 1,
      dominantColor: null,
      blurPlaceholder: null,
      altText: null,
      source: MediaSource.UPLOAD,
      checksum: id,
      createdBy: null,
      createdAt: now,
    };
  }

  public async findProductById(id: string): Promise<ProductEntity | null> {
    return id === productId ? productEntity : null;
  }

  public async findProductBySlug(_slug: string): Promise<ProductAggregate | null> {
    return null;
  }

  public async getProductAggregate(_id: string): Promise<ProductAggregate | null> {
    return null;
  }

  public async searchProducts(_filters: ProductSearchFilters): Promise<ProductSearchResult> {
    return { items: this.searchItems, nextCursor: null };
  }

  public async createProduct(_input: CreateProductRecord): Promise<ProductEntity> {
    throw new Error("unexpected");
  }

  public async updateProduct(_input: UpdateProductRecord, _previousSlug?: string): Promise<ProductEntity | null> {
    throw new Error("unexpected");
  }

  public async archiveProduct(_id: string, _archivedAt: Date): Promise<ProductEntity | null> {
    throw new Error("unexpected");
  }

  public async createVariant(_input: CreateVariantRecord): Promise<ProductVariantEntity> {
    throw new Error("unexpected");
  }

  public async updateVariant(_input: UpdateVariantRecord): Promise<ProductVariantEntity | null> {
    throw new Error("unexpected");
  }

  public async deleteVariant(_id: string): Promise<void> {
    throw new Error("unexpected");
  }

  public async replaceSpecs(_productId: string, _groups: ReplaceSpecGroupRecord[]): Promise<SpecGroupEntity[]> {
    throw new Error("unexpected");
  }

  public async replaceProductMedia(_input: ReplaceProductMediaRecord): Promise<ProductMediaEntity[]> {
    throw new Error("unexpected");
  }

  public async enqueueOutbox(_event: {
    id: string;
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    throw new Error("unexpected");
  }
}

const productEntity: ProductEntity = {
  id: productId,
  slug: "smartphone-demo",
  title: "Smartphone Demo",
  subtitle: null,
  description: "Descripcion completa para producto demo.",
  brandId: null,
  categoryId: "11111111-1111-4111-8111-111111111114",
  status: ProductStatus.DRAFT,
  mainImageId: null,
  sku: "DEMO",
  seoTitle: null,
  seoDescription: null,
  publishedAt: null,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const productAggregate: ProductAggregate = {
  product: productEntity,
  category: {
    id: "11111111-1111-4111-8111-111111111114",
    parentId: null,
    name: "Celulares",
    slug: "celulares",
    description: null,
    imageId: null,
    position: 0,
    isActive: true,
    seoTitle: null,
    seoDescription: null,
    createdAt: now,
    updatedAt: now,
  },
  brand: null,
  mainImage: null,
  media: [],
  variants: [],
  specs: [],
};
