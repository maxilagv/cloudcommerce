import { StoreAutocompleteSchema, StoreProductBySlugSchema, StoreSearchProductsSchema } from "@cloudcommerce/validators";
import type { CatalogDomainError } from "../../../shared/errors/domain-error.js";
import { appErrorToTrpcError, catalogErrorToAppError } from "../../../shared/errors/http-error.js";
import { publicProcedure, router } from "../../../interfaces/trpc/middleware/auth.js";

const throwCatalog = (error: CatalogDomainError): never => {
  throw appErrorToTrpcError(catalogErrorToAppError(error));
};

/**
 * Catálogo público del store (Fase 10): sin sesión, solo lectura, solo
 * productos PUBLISHED y categorías activas. Consumido por apps/store.
 */
export const storeRouter = router({
  categories: publicProcedure.query(async ({ ctx }) => {
    const result = await ctx.container.catalog.publicListCategories();
    if (!result.ok) return throwCatalog(result.error);
    return result.value;
  }),

  products: router({
    list: publicProcedure.input(StoreSearchProductsSchema).query(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.publicSearchProducts(input);
      if (!result.ok) return throwCatalog(result.error);
      return result.value;
    }),

    bySlug: publicProcedure.input(StoreProductBySlugSchema).query(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.publicGetProductBySlug(input.slug);
      if (!result.ok) return throwCatalog(result.error);
      return result.value;
    }),

    autocomplete: publicProcedure.input(StoreAutocompleteSchema).query(async ({ ctx, input }) => {
      const result = await ctx.container.catalog.publicAutocomplete(input.query);
      if (!result.ok) return throwCatalog(result.error);
      return result.value;
    }),
  }),
});
