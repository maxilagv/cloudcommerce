import {
  CreateBrandInputSchema,
  CreateCategoryInputSchema,
  CreateProductInputSchema,
  CreateProductVariantInputSchema,
  DeleteProductVariantInputSchema,
  ListCategoriesInputSchema,
  ProductIdInputSchema,
  ProductSlugInputSchema,
  PublishProductInputSchema,
  ReplaceProductMediaInputSchema,
  ReplaceProductSpecsInputSchema,
  SearchProductsInputSchema,
  SetProductStatusInputSchema,
  UpdateBrandInputSchema,
  UpdateCategoryInputSchema,
  UpdateProductInputSchema,
  UpdateProductVariantInputSchema,
} from "@cloudcommerce/validators";
import { z } from "zod";
import type { CatalogDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, catalogErrorToAppError } from "../../../shared/errors/http-error.js";
import { adminProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";

const throwCatalog = (error: CatalogDomainError): never => {
  throw appErrorToTrpcError(catalogErrorToAppError(error));
};

export const catalogRouter = router({
  categories: router({
    list: adminProcedure.input(ListCategoriesInputSchema).query(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.listCategoryTree(ctx.actor, input.includeInactive);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    create: adminProcedure.input(CreateCategoryInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.createCategory(ctx.actor, input);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    update: adminProcedure.input(UpdateCategoryInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.updateCategory(ctx.actor, input);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
  }),

  brands: router({
    list: adminProcedure.input(z.object({ includeInactive: z.boolean().default(false) })).query(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.listBrands(ctx.actor, input.includeInactive);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    create: adminProcedure.input(CreateBrandInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.createBrand(ctx.actor, input);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    update: adminProcedure.input(UpdateBrandInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.updateBrand(ctx.actor, input);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
  }),

  products: router({
    search: adminProcedure.input(SearchProductsInputSchema).query(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.searchProducts(ctx.actor, input);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    autocomplete: adminProcedure.input(z.object({ query: z.string().trim().min(1).max(160) })).query(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.autocomplete(ctx.actor, input.query);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    byId: adminProcedure.input(ProductIdInputSchema).query(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.getProduct(ctx.actor, input.productId);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    bySlug: adminProcedure.input(ProductSlugInputSchema).query(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.getProductBySlug(ctx.actor, input.slug);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    create: adminProcedure.input(CreateProductInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.createProduct(ctx.actor, input);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    update: adminProcedure.input(UpdateProductInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.updateProduct(ctx.actor, input);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    setStatus: adminProcedure.input(SetProductStatusInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.setProductStatus(ctx.actor, input.productId, input.status);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    publish: adminProcedure.input(PublishProductInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.publishProduct(ctx.actor, input.productId);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
  }),

  variants: router({
    create: adminProcedure.input(CreateProductVariantInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.createVariant(ctx.actor, input);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    update: adminProcedure.input(UpdateProductVariantInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.updateVariant(ctx.actor, input);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
    delete: adminProcedure.input(DeleteProductVariantInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.deleteVariant(ctx.actor, input.id);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
  }),

  specs: router({
    replace: adminProcedure.input(ReplaceProductSpecsInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.replaceSpecs(ctx.actor, input);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
  }),

  media: router({
    replace: adminProcedure.input(ReplaceProductMediaInputSchema).mutation(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.replaceProductMedia(ctx.actor, input);
      if (!result.ok) {
        return throwCatalog(result.error);
      }
      return result.value;
    }),
  }),
});
