import {
  ProductStatus,
  StockStatus,
  type Actor,
  type BrandResponse,
  type CategoryNode,
  type CursorPage,
  type MediaAssetResponse,
  type ProductAdminDetail,
  type ProductCard,
  type ProductMediaResponse,
  type ProductVariantResponse,
  type PublishChecklistItem,
  type SpecGroupResponse,
} from "@cloudcommerce/types";
import type {
  CreateBrandInput,
  CreateCategoryInput,
  CreateProductInput,
  CreateProductVariantInput,
  ReplaceProductMediaInput,
  ReplaceProductSpecsInput,
  SearchProductsInput,
  StoreSearchProductsInput,
  UpdateBrandInput,
  UpdateCategoryInput,
  UpdateProductInput,
  UpdateProductVariantInput,
} from "@cloudcommerce/validators";
import { v7 as uuidv7 } from "uuid";
import { err, ok, type Result } from "../../../../shared/domain/result.js";
import type { CatalogDomainError } from "../../../../shared/errors/domain-error.js";
import type { InMemoryEventBus } from "../../../../shared/events/event-bus.js";
import type {
  BrandEntity,
  CategoryEntity,
  MediaAssetEntity,
  ProductAggregate,
  ProductMediaEntity,
  ProductVariantEntity,
  SpecGroupEntity,
} from "../../domain/entities/catalog-entities.js";
import { canPublishCatalog, canReadCatalog, canWriteCatalog } from "../../domain/policies/catalog-permissions.js";
import {
  buildPublicationChecklist,
  canTransitionProductStatus,
  publicationBlockingFailures,
} from "../../domain/policies/product-publication.js";
import type {
  CatalogRepository,
  PriceReaderPort,
  StockReaderPort,
  ProductSearchFilters,
  UpdateBrandRecord,
  UpdateCategoryRecord,
  UpdateProductRecord,
  UpdateVariantRecord,
} from "../ports/catalog-repository.js";

export class CatalogService {
  public constructor(
    private readonly repository: CatalogRepository,
    private readonly priceReader: PriceReaderPort,
    private readonly stockReader: StockReaderPort,
    private readonly eventBus?: InMemoryEventBus,
  ) {}

  public async listCategoryTree(actor: Actor, includeInactive: boolean): Promise<Result<CategoryNode[], CatalogDomainError>> {
    if (!canReadCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const categories = await this.repository.listCategories(includeInactive);
    return ok(this.buildCategoryTree(categories));
  }

  public async createCategory(actor: Actor, input: CreateCategoryInput): Promise<Result<CategoryNode, CatalogDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    if (input.parentId && !(await this.repository.findCategoryById(input.parentId))) {
      return err({ type: "CATEGORY_NOT_FOUND" });
    }
    if (input.imageId && !(await this.repository.findMediaAssetById(input.imageId))) {
      return err({ type: "MEDIA_NOT_FOUND" });
    }
    const conflict = await this.repository.findCategoryByParentAndSlug(input.parentId ?? null, input.slug);
    if (conflict) {
      return err({ type: "PRODUCT_SLUG_CONFLICT" });
    }
    const category = await this.repository.createCategory({
      id: uuidv7(),
      parentId: input.parentId ?? null,
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      imageId: input.imageId ?? null,
      position: input.position,
      isActive: input.isActive,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
    });
    return ok({ ...this.presentCategory(category), children: [] });
  }

  public async updateCategory(actor: Actor, input: UpdateCategoryInput): Promise<Result<CategoryNode, CatalogDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const existing = await this.repository.findCategoryById(input.id);
    if (!existing) {
      return err({ type: "CATEGORY_NOT_FOUND" });
    }
    if (input.parentId !== undefined) {
      if (input.parentId === input.id) {
        return err({ type: "CATEGORY_TREE_INVALID" });
      }
      if (input.parentId && !(await this.repository.findCategoryById(input.parentId))) {
        return err({ type: "CATEGORY_NOT_FOUND" });
      }
      if (input.parentId && (await this.isDescendant(input.parentId, input.id))) {
        return err({ type: "CATEGORY_TREE_INVALID" });
      }
    }
    if (input.imageId !== undefined && input.imageId !== null && !(await this.repository.findMediaAssetById(input.imageId))) {
      return err({ type: "MEDIA_NOT_FOUND" });
    }
    if (input.slug !== undefined || input.parentId !== undefined) {
      const slug = input.slug ?? existing.slug;
      const parentId = input.parentId === undefined ? existing.parentId : input.parentId;
      const conflict = await this.repository.findCategoryByParentAndSlug(parentId ?? null, slug);
      if (conflict && conflict.id !== existing.id) {
        return err({ type: "PRODUCT_SLUG_CONFLICT" });
      }
    }
    const updateCategory: UpdateCategoryRecord = { id: input.id };
    if (input.parentId !== undefined) updateCategory.parentId = input.parentId;
    if (input.name !== undefined) updateCategory.name = input.name;
    if (input.slug !== undefined) updateCategory.slug = input.slug;
    if (input.description !== undefined) updateCategory.description = input.description;
    if (input.imageId !== undefined) updateCategory.imageId = input.imageId;
    if (input.position !== undefined) updateCategory.position = input.position;
    if (input.isActive !== undefined) updateCategory.isActive = input.isActive;
    if (input.seoTitle !== undefined) updateCategory.seoTitle = input.seoTitle;
    if (input.seoDescription !== undefined) updateCategory.seoDescription = input.seoDescription;
    const updated = await this.repository.updateCategory(updateCategory);
    if (!updated) {
      return err({ type: "CATEGORY_NOT_FOUND" });
    }
    return ok({ ...this.presentCategory(updated), children: [] });
  }

  public async listBrands(actor: Actor, includeInactive: boolean): Promise<Result<BrandResponse[], CatalogDomainError>> {
    if (!canReadCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const brands = await this.repository.listBrands(includeInactive);
    return ok(brands.map(this.presentBrand));
  }

  public async createBrand(actor: Actor, input: CreateBrandInput): Promise<Result<BrandResponse, CatalogDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    if (input.logoId && !(await this.repository.findMediaAssetById(input.logoId))) {
      return err({ type: "MEDIA_NOT_FOUND" });
    }
    const conflict = await this.repository.findBrandBySlug(input.slug);
    if (conflict) {
      return err({ type: "PRODUCT_SLUG_CONFLICT" });
    }
    const brand = await this.repository.createBrand({
      id: uuidv7(),
      name: input.name,
      slug: input.slug,
      logoId: input.logoId ?? null,
      isActive: input.isActive,
    });
    return ok(this.presentBrand(brand));
  }

  public async updateBrand(actor: Actor, input: UpdateBrandInput): Promise<Result<BrandResponse, CatalogDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const existing = await this.repository.findBrandById(input.id);
    if (!existing) {
      return err({ type: "BRAND_NOT_FOUND" });
    }
    if (input.logoId !== undefined && input.logoId !== null && !(await this.repository.findMediaAssetById(input.logoId))) {
      return err({ type: "MEDIA_NOT_FOUND" });
    }
    if (input.slug !== undefined) {
      const conflict = await this.repository.findBrandBySlug(input.slug);
      if (conflict && conflict.id !== existing.id) {
        return err({ type: "PRODUCT_SLUG_CONFLICT" });
      }
    }
    const updateBrand: UpdateBrandRecord = { id: input.id };
    if (input.name !== undefined) updateBrand.name = input.name;
    if (input.slug !== undefined) updateBrand.slug = input.slug;
    if (input.logoId !== undefined) updateBrand.logoId = input.logoId;
    if (input.isActive !== undefined) updateBrand.isActive = input.isActive;
    const updated = await this.repository.updateBrand(updateBrand);
    if (!updated) {
      return err({ type: "BRAND_NOT_FOUND" });
    }
    return ok(this.presentBrand(updated));
  }

  public async createProduct(actor: Actor, input: CreateProductInput): Promise<Result<ProductAdminDetail, CatalogDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const category = await this.repository.findCategoryById(input.categoryId);
    if (!category || !category.isActive) {
      return err({ type: "CATEGORY_NOT_FOUND" });
    }
    if (input.brandId && !(await this.repository.findBrandById(input.brandId))) {
      return err({ type: "BRAND_NOT_FOUND" });
    }
    if (input.mainImageId && !(await this.repository.findMediaAssetById(input.mainImageId))) {
      return err({ type: "MEDIA_NOT_FOUND" });
    }
    if (await this.repository.findProductBySlug(input.slug)) {
      return err({ type: "PRODUCT_SLUG_CONFLICT" });
    }
    const product = await this.repository.createProduct({
      id: uuidv7(),
      slug: input.slug,
      title: input.title,
      subtitle: input.subtitle ?? null,
      description: input.description,
      brandId: input.brandId ?? null,
      categoryId: input.categoryId,
      mainImageId: input.mainImageId ?? null,
      sku: input.sku ?? null,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      status: ProductStatus.DRAFT,
    });
    const aggregate = await this.repository.getProductAggregate(product.id);
    if (!aggregate) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    return ok(await this.presentDetail(aggregate));
  }

  public async updateProduct(actor: Actor, input: UpdateProductInput): Promise<Result<ProductAdminDetail, CatalogDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const existing = await this.repository.findProductById(input.id);
    if (!existing) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    const validation = await this.validateProductReferences(input);
    if (!validation.ok) {
      return err(validation.error);
    }
    if (input.slug !== undefined && input.slug !== existing.slug) {
      const conflict = await this.repository.findProductBySlug(input.slug);
      if (conflict && conflict.product.id !== existing.id) {
        return err({ type: "PRODUCT_SLUG_CONFLICT" });
      }
    }
    const update: UpdateProductRecord = { id: input.id };
    if (input.slug !== undefined) update.slug = input.slug;
    if (input.title !== undefined) update.title = input.title;
    if (input.subtitle !== undefined) update.subtitle = input.subtitle;
    if (input.description !== undefined) update.description = input.description;
    if (input.brandId !== undefined) update.brandId = input.brandId;
    if (input.categoryId !== undefined) update.categoryId = input.categoryId;
    if (input.mainImageId !== undefined) update.mainImageId = input.mainImageId;
    if (input.sku !== undefined) update.sku = input.sku;
    if (input.seoTitle !== undefined) update.seoTitle = input.seoTitle;
    if (input.seoDescription !== undefined) update.seoDescription = input.seoDescription;
    const updated = await this.repository.updateProduct(update, input.slug !== undefined && input.slug !== existing.slug ? existing.slug : undefined);
    if (!updated) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    const aggregate = await this.repository.getProductAggregate(updated.id);
    if (!aggregate) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    return ok(await this.presentDetail(aggregate));
  }

  public async getProduct(actor: Actor, productId: string): Promise<Result<ProductAdminDetail, CatalogDomainError>> {
    if (!canReadCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const aggregate = await this.repository.getProductAggregate(productId);
    if (!aggregate) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    return ok(await this.presentDetail(aggregate));
  }

  public async getProductBySlug(actor: Actor, slug: string): Promise<Result<ProductAdminDetail, CatalogDomainError>> {
    if (!canReadCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const aggregate = await this.repository.findProductBySlug(slug);
    if (!aggregate) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    return ok(await this.presentDetail(aggregate));
  }

  public async searchProducts(actor: Actor, input: SearchProductsInput): Promise<Result<CursorPage<ProductCard>, CatalogDomainError>> {
    if (!canReadCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const filters: ProductSearchFilters = {
      limit: input.limit,
      sort: input.sort,
    };
    if (input.query !== undefined) filters.query = input.query;
    if (input.categoryId !== undefined) filters.categoryId = input.categoryId;
    if (input.brandId !== undefined) filters.brandId = input.brandId;
    if (input.status !== undefined) filters.status = input.status;
    if (input.cursor !== undefined) filters.cursor = input.cursor;
    const result = await this.repository.searchProducts(filters);
    return ok({
      items: await Promise.all(result.items.map((item) => this.presentCard(item))),
      nextCursor: result.nextCursor,
    });
  }

  public async autocomplete(actor: Actor, query: string): Promise<Result<ProductCard[], CatalogDomainError>> {
    const result = await this.searchProducts(actor, { query, limit: 10, sort: "title_asc" });
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.items);
  }

  // ------------------------------------------------------------------
  // Catálogo público del store (Fase 10). Sin actor: solo lectura de
  // categorías activas y productos PUBLISHED; el shape es el mismo
  // ProductCard/Detail sin datos sensibles (el costo vive en pricing).
  // ------------------------------------------------------------------

  public async publicListCategories(): Promise<Result<CategoryNode[], CatalogDomainError>> {
    const categories = await this.repository.listCategories(false);
    return ok(this.buildCategoryTree(categories));
  }

  public async publicSearchProducts(input: StoreSearchProductsInput): Promise<Result<CursorPage<ProductCard>, CatalogDomainError>> {
    const filters: ProductSearchFilters = {
      limit: input.limit,
      sort: input.sort,
      status: ProductStatus.PUBLISHED,
    };
    if (input.query !== undefined) filters.query = input.query;
    if (input.categoryId !== undefined) filters.categoryId = input.categoryId;
    if (input.brandId !== undefined) filters.brandId = input.brandId;
    if (input.cursor !== undefined) filters.cursor = input.cursor;
    const result = await this.repository.searchProducts(filters);
    return ok({
      items: await Promise.all(result.items.map((item) => this.presentCard(item))),
      nextCursor: result.nextCursor,
    });
  }

  public async publicGetProductBySlug(slug: string): Promise<Result<ProductAdminDetail, CatalogDomainError>> {
    const aggregate = await this.repository.findPublishedProductBySlug(slug);
    if (!aggregate) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    return ok(await this.presentDetail(aggregate));
  }

  public async publicAutocomplete(query: string): Promise<Result<ProductCard[], CatalogDomainError>> {
    const result = await this.publicSearchProducts({ query, limit: 8, sort: "title_asc" });
    if (!result.ok) {
      return err(result.error);
    }
    return ok(result.value.items);
  }

  public async setProductStatus(
    actor: Actor,
    productId: string,
    status: ProductStatus,
  ): Promise<Result<{ product: ProductAdminDetail; checklist?: PublishChecklistItem[] }, CatalogDomainError>> {
    if (status === ProductStatus.PUBLISHED) {
      return this.publishProduct(actor, productId);
    }
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const existing = await this.repository.findProductById(productId);
    if (!existing) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    if (!canTransitionProductStatus(existing.status, status)) {
      return err({ type: "PRODUCT_STATUS_TRANSITION_INVALID" });
    }
    const updated =
      status === ProductStatus.ARCHIVED
        ? await this.repository.archiveProduct(productId, new Date())
        : await this.repository.updateProduct({ id: productId, status, publishedAt: status === ProductStatus.PAUSED ? existing.publishedAt : existing.publishedAt });
    if (!updated) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    const aggregate = await this.repository.getProductAggregate(updated.id);
    if (!aggregate) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    return ok({ product: await this.presentDetail(aggregate) });
  }

  public async publishProduct(
    actor: Actor,
    productId: string,
  ): Promise<Result<{ product: ProductAdminDetail; checklist: PublishChecklistItem[] }, CatalogDomainError>> {
    if (!canPublishCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const aggregate = await this.repository.getProductAggregate(productId);
    if (!aggregate) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    if (!canTransitionProductStatus(aggregate.product.status, ProductStatus.PUBLISHED)) {
      return err({ type: "PRODUCT_STATUS_TRANSITION_INVALID" });
    }
    const [price, stockStatus] = await Promise.all([
      this.priceReader.getProductPrice(productId),
      this.stockReader.getProductStockStatus(productId),
    ]);
    const checklist = buildPublicationChecklist(aggregate, {
      hasPrice: price !== null,
      stockStatus,
    });
    const failures = publicationBlockingFailures(checklist);
    if (failures.length > 0) {
      return err({ type: "PRODUCT_NOT_PUBLISHABLE", failures: failures.map((failure) => failure.key) });
    }
    const updated = await this.repository.updateProduct({
      id: productId,
      status: ProductStatus.PUBLISHED,
      publishedAt: new Date(),
    });
    if (!updated) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    await this.repository.enqueueOutbox({
      id: uuidv7(),
      aggregateType: "product",
      aggregateId: productId,
      eventType: "catalog.product_published",
      payload: { productId },
    });
    await this.eventBus?.publish({
      id: uuidv7(),
      type: "catalog.product_published",
      aggregateType: "product",
      aggregateId: productId,
      payload: { productId },
      occurredAt: new Date(),
    });
    const published = await this.repository.getProductAggregate(productId);
    if (!published) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    return ok({ product: await this.presentDetail(published), checklist });
  }

  public async createVariant(
    actor: Actor,
    input: CreateProductVariantInput,
  ): Promise<Result<ProductVariantResponse, CatalogDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    if (!(await this.repository.findProductById(input.productId))) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    const variant = await this.repository.createVariant({
      id: uuidv7(),
      productId: input.productId,
      sku: input.sku,
      title: input.title,
      isActive: input.isActive,
      attributes: input.attributes,
      position: input.position,
    });
    return ok(this.presentVariant(variant));
  }

  public async updateVariant(
    actor: Actor,
    input: UpdateProductVariantInput,
  ): Promise<Result<ProductVariantResponse, CatalogDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    const updateVariant: UpdateVariantRecord = { id: input.id };
    if (input.productId !== undefined) updateVariant.productId = input.productId;
    if (input.sku !== undefined) updateVariant.sku = input.sku;
    if (input.title !== undefined) updateVariant.title = input.title;
    if (input.isActive !== undefined) updateVariant.isActive = input.isActive;
    if (input.attributes !== undefined) updateVariant.attributes = input.attributes;
    if (input.position !== undefined) updateVariant.position = input.position;
    const variant = await this.repository.updateVariant(updateVariant);
    if (!variant) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    return ok(this.presentVariant(variant));
  }

  public async deleteVariant(actor: Actor, variantId: string): Promise<Result<{ deleted: true }, CatalogDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    await this.repository.deleteVariant(variantId);
    return ok({ deleted: true });
  }

  public async replaceSpecs(actor: Actor, input: ReplaceProductSpecsInput): Promise<Result<SpecGroupResponse[], CatalogDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    if (!(await this.repository.findProductById(input.productId))) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    const groups = await this.repository.replaceSpecs(
      input.productId,
      input.groups.map((group) => ({
        id: uuidv7(),
        productId: input.productId,
        name: group.name,
        position: group.position,
        items: group.items.map((item) => ({
          id: uuidv7(),
          key: item.key,
          label: item.label,
          valueText: item.valueText ?? null,
          valueNum: item.valueNum ?? null,
          unit: item.unit ?? null,
          position: item.position,
        })),
      })),
    );
    return ok(groups.map(this.presentSpecGroup));
  }

  public async replaceProductMedia(
    actor: Actor,
    input: ReplaceProductMediaInput,
  ): Promise<Result<ProductMediaResponse[], CatalogDomainError>> {
    if (!canWriteCatalog(actor)) {
      return err(actor.kind === "admin" ? { type: "FORBIDDEN" } : { type: "UNAUTHENTICATED" });
    }
    if (!(await this.repository.findProductById(input.productId))) {
      return err({ type: "PRODUCT_NOT_FOUND" });
    }
    const mediaIds = new Set(input.media.map((item) => item.mediaAssetId));
    const positions = new Set(input.media.map((item) => item.position));
    if (input.media.length < 1 || input.media.length > 6 || mediaIds.size !== input.media.length || positions.size !== input.media.length) {
      return err({ type: "PRODUCT_MEDIA_CARDINALITY_INVALID" });
    }
    if (!mediaIds.has(input.mainImageId)) {
      return err({ type: "PRODUCT_MEDIA_CARDINALITY_INVALID" });
    }
    for (const mediaItem of input.media) {
      if (!(await this.repository.findMediaAssetById(mediaItem.mediaAssetId))) {
        return err({ type: "MEDIA_NOT_FOUND" });
      }
    }
    const rows = await this.repository.replaceProductMedia({
      productId: input.productId,
      mainImageId: input.mainImageId,
      media: input.media.map((item) => ({
        id: uuidv7(),
        mediaAssetId: item.mediaAssetId,
        position: item.position,
        altText: item.altText ?? null,
      })),
    });
    return ok(rows.map(this.presentProductMedia));
  }

  private async validateProductReferences(input: UpdateProductInput): Promise<Result<true, CatalogDomainError>> {
    if (input.categoryId !== undefined) {
      const category = await this.repository.findCategoryById(input.categoryId);
      if (!category || !category.isActive) {
        return err({ type: "CATEGORY_NOT_FOUND" });
      }
    }
    if (input.brandId !== undefined && input.brandId !== null && !(await this.repository.findBrandById(input.brandId))) {
      return err({ type: "BRAND_NOT_FOUND" });
    }
    if (input.mainImageId !== undefined && input.mainImageId !== null && !(await this.repository.findMediaAssetById(input.mainImageId))) {
      return err({ type: "MEDIA_NOT_FOUND" });
    }
    return ok(true);
  }

  private async isDescendant(candidateId: string, ancestorId: string): Promise<boolean> {
    const categories = await this.repository.listCategories(true);
    const byId = new Map(categories.map((item) => [item.id, item]));
    let current = byId.get(candidateId) ?? null;
    while (current) {
      if (current.parentId === ancestorId) {
        return true;
      }
      current = current.parentId ? byId.get(current.parentId) ?? null : null;
    }
    return false;
  }

  private buildCategoryTree(categories: CategoryEntity[]): CategoryNode[] {
    const nodes = new Map(categories.map((item) => [item.id, { ...this.presentCategory(item), children: [] as CategoryNode[] }]));
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      if (node.parentId && nodes.has(node.parentId)) {
        nodes.get(node.parentId)?.children.push(node);
      } else {
        roots.push(node);
      }
    }
    const sort = (items: CategoryNode[]): CategoryNode[] =>
      items
        .sort((left, right) => left.position - right.position || left.name.localeCompare(right.name))
        .map((item) => ({ ...item, children: sort(item.children) }));
    return sort(roots);
  }

  private presentCategory(category: CategoryEntity): Omit<CategoryNode, "children"> {
    return {
      id: category.id,
      parentId: category.parentId,
      name: category.name,
      slug: category.slug,
      description: category.description,
      imageId: category.imageId,
      position: category.position,
      isActive: category.isActive,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  private presentBrand(brand: BrandEntity): BrandResponse {
    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoId: brand.logoId,
      isActive: brand.isActive,
    };
  }

  private presentMediaAsset(asset: MediaAssetEntity | null): MediaAssetResponse | null {
    if (!asset) {
      return null;
    }
    return {
      id: asset.id,
      mime: asset.mime,
      byteSize: asset.byteSize,
      width: asset.width,
      height: asset.height,
      dominantColor: asset.dominantColor,
      blurPlaceholder: asset.blurPlaceholder,
      altText: asset.altText,
      source: asset.source,
      checksum: asset.checksum,
      createdAt: asset.createdAt.toISOString(),
    };
  }

  private async presentCard(aggregate: ProductAggregate): Promise<ProductCard> {
    const [price, stockStatus] = await Promise.all([
      this.priceReader.getProductPrice(aggregate.product.id),
      this.stockReader.getProductStockStatus(aggregate.product.id),
    ]);
    return {
      id: aggregate.product.id,
      slug: aggregate.product.slug,
      title: aggregate.product.title,
      subtitle: aggregate.product.subtitle,
      brand: aggregate.brand ? this.presentBrand(aggregate.brand) : null,
      category: aggregate.category
        ? {
            id: aggregate.category.id,
            name: aggregate.category.name,
            slug: aggregate.category.slug,
          }
        : null,
      mainImage: this.presentMediaAsset(aggregate.mainImage),
      price: price ? { amountMinor: price.salePriceMinor, currency: price.currency } : null,
      compareAtPrice: price?.compareAtPriceMinor ? { amountMinor: price.compareAtPriceMinor, currency: price.currency } : null,
      currency: "ARS",
      stockStatus,
      status: aggregate.product.status,
      sku: aggregate.product.sku,
      seoTitle: aggregate.product.seoTitle,
      seoDescription: aggregate.product.seoDescription,
      createdAt: aggregate.product.createdAt.toISOString(),
      updatedAt: aggregate.product.updatedAt.toISOString(),
    };
  }

  private async presentDetail(aggregate: ProductAggregate): Promise<ProductAdminDetail> {
    const card = await this.presentCard(aggregate);
    return {
      ...card,
      description: aggregate.product.description,
      publishedAt: aggregate.product.publishedAt?.toISOString() ?? null,
      variants: aggregate.variants.map(this.presentVariant),
      specs: aggregate.specs.map(this.presentSpecGroup),
      media: aggregate.media.map(this.presentProductMedia),
    };
  }

  private presentVariant(variant: ProductVariantEntity): ProductVariantResponse {
    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      title: variant.title,
      isActive: variant.isActive,
      attributes: sanitizeAttributes(variant.attributes),
      position: variant.position,
    };
  }

  private presentSpecGroup(group: SpecGroupEntity): SpecGroupResponse {
    return {
      id: group.id,
      name: group.name,
      position: group.position,
      items: group.items.map((item) => ({
        id: item.id,
        key: item.key,
        label: item.label,
        valueText: item.valueText,
        valueNum: item.valueNum,
        unit: item.unit,
        position: item.position,
      })),
    };
  }

  private presentProductMedia(media: ProductMediaEntity): ProductMediaResponse {
    return {
      id: media.id,
      productId: media.productId,
      mediaAssetId: media.mediaAssetId,
      position: media.position,
      altText: media.altText,
      asset: this.presentMediaAsset(media.asset),
    };
  }
}

const sanitizeAttributes = (attributes: Record<string, unknown>): Record<string, string | number | boolean | null> => {
  const sanitized: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export class PlaceholderPriceReader implements PriceReaderPort {
  public async getProductPrice(_productId: string): Promise<{ salePriceMinor: number; compareAtPriceMinor: number | null; currency: "ARS" } | null> {
    return null;
  }
}

export class PlaceholderStockReader implements StockReaderPort {
  public async getProductStockStatus(_productId: string): Promise<StockStatus> {
    return StockStatus.OUT_OF_STOCK;
  }
}

