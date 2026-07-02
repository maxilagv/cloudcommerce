import { ProductStatus } from "@cloudcommerce/types";
import { z } from "zod";
import { UuidSchema } from "./common.js";

const SlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const NameSchema = z.string().trim().min(2).max(160);
const OptionalTextSchema = z.string().trim().max(5_000).optional().nullable();
const SeoTitleSchema = z.string().trim().min(10).max(70).optional().nullable();
const SeoDescriptionSchema = z.string().trim().min(30).max(170).optional().nullable();

const forbiddenJsonKeys = new Set(["__proto__", "prototype", "constructor"]);

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(500),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema).max(50),
    z.record(z.string().min(1).max(80), JsonValueSchema),
  ]),
);

function rejectPrototypePollutionKeys(value: unknown, ctx: z.RefinementCtx, path: Array<string | number> = []): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => rejectPrototypePollutionKeys(item, ctx, [...path, index]));
    return;
  }

  if (value === null || typeof value !== "object") {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenJsonKeys.has(key)) {
      ctx.addIssue({
        code: "custom",
        path: [...path, key],
        message: "Forbidden JSON key",
      });
    }
    rejectPrototypePollutionKeys(child, ctx, [...path, key]);
  }
}

export const SafeAttributesSchema = z
  .record(z.string().min(1).max(80), JsonValueSchema)
  .superRefine((value, ctx) => rejectPrototypePollutionKeys(value, ctx));

export const ProductStatusSchema = z.nativeEnum(ProductStatus);

export const CreateCategoryInputSchema = z.object({
  parentId: UuidSchema.optional().nullable(),
  name: NameSchema,
  slug: SlugSchema,
  description: OptionalTextSchema,
  imageId: UuidSchema.optional().nullable(),
  position: z.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
  seoTitle: SeoTitleSchema,
  seoDescription: SeoDescriptionSchema,
});

export const UpdateCategoryInputSchema = CreateCategoryInputSchema.partial()
  .extend({
    id: UuidSchema,
  })
  .refine((value) => Object.keys(value).length > 1, "No category fields provided");

export const ListCategoriesInputSchema = z.object({
  includeInactive: z.boolean().default(false),
});

export const CreateBrandInputSchema = z.object({
  name: NameSchema,
  slug: SlugSchema,
  logoId: UuidSchema.optional().nullable(),
  isActive: z.boolean().default(true),
});

export const UpdateBrandInputSchema = CreateBrandInputSchema.partial()
  .extend({
    id: UuidSchema,
  })
  .refine((value) => Object.keys(value).length > 1, "No brand fields provided");

export const CreateProductInputSchema = z.object({
  slug: SlugSchema,
  title: NameSchema,
  subtitle: z.string().trim().max(240).optional().nullable(),
  description: z.string().trim().min(1).max(20_000),
  brandId: UuidSchema.optional().nullable(),
  categoryId: UuidSchema,
  mainImageId: UuidSchema.optional().nullable(),
  sku: z.string().trim().min(2).max(80).optional().nullable(),
  seoTitle: SeoTitleSchema,
  seoDescription: SeoDescriptionSchema,
});

export const UpdateProductInputSchema = CreateProductInputSchema.partial()
  .extend({
    id: UuidSchema,
  })
  .refine((value) => Object.keys(value).length > 1, "No product fields provided");

export const ProductIdInputSchema = z.object({
  productId: UuidSchema,
});

export const ProductSlugInputSchema = z.object({
  slug: SlugSchema,
});

export const SetProductStatusInputSchema = ProductIdInputSchema.extend({
  status: ProductStatusSchema,
});

export const PublishProductInputSchema = ProductIdInputSchema;

export const CreateProductVariantInputSchema = ProductIdInputSchema.extend({
  sku: z.string().trim().min(2).max(80),
  title: z.string().trim().min(1).max(160),
  isActive: z.boolean().default(true),
  attributes: SafeAttributesSchema.default({}),
  position: z.number().int().min(0).max(10_000).default(0),
});

export const UpdateProductVariantInputSchema = CreateProductVariantInputSchema.partial()
  .extend({
    id: UuidSchema,
  })
  .refine((value) => Object.keys(value).length > 1, "No variant fields provided");

export const DeleteProductVariantInputSchema = z.object({
  id: UuidSchema,
});

export const SpecItemInputSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(160),
    valueText: z.string().trim().max(500).optional().nullable(),
    valueNum: z.number().finite().optional().nullable(),
    unit: z.string().trim().max(40).optional().nullable(),
    position: z.number().int().min(0).max(10_000).default(0),
  })
  .refine((value) => value.valueText !== undefined || value.valueNum !== undefined, {
    message: "Spec item needs a text or numeric value",
    path: ["valueText"],
  });

export const SpecGroupInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  position: z.number().int().min(0).max(10_000).default(0),
  items: z.array(SpecItemInputSchema).min(1).max(50),
});

export const ReplaceProductSpecsInputSchema = ProductIdInputSchema.extend({
  groups: z.array(SpecGroupInputSchema).min(1).max(20),
});

export const ProductMediaItemInputSchema = z.object({
  mediaAssetId: UuidSchema,
  position: z.number().int().min(0).max(5),
  altText: z.string().trim().max(160).optional().nullable(),
});

export const ReplaceProductMediaInputSchema = ProductIdInputSchema.extend({
  media: z.array(ProductMediaItemInputSchema).min(1).max(6),
  mainImageId: UuidSchema,
});

export const SearchProductsInputSchema = z.object({
  query: z.string().trim().min(1).max(160).optional(),
  categoryId: UuidSchema.optional(),
  brandId: UuidSchema.optional(),
  status: ProductStatusSchema.optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  sort: z.enum(["created_desc", "created_asc", "title_asc", "updated_desc"]).default("created_desc"),
});

export type CreateCategoryInput = z.infer<typeof CreateCategoryInputSchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategoryInputSchema>;
export type CreateBrandInput = z.infer<typeof CreateBrandInputSchema>;
export type UpdateBrandInput = z.infer<typeof UpdateBrandInputSchema>;
export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;
export type CreateProductVariantInput = z.infer<typeof CreateProductVariantInputSchema>;
export type UpdateProductVariantInput = z.infer<typeof UpdateProductVariantInputSchema>;
export type ReplaceProductSpecsInput = z.infer<typeof ReplaceProductSpecsInputSchema>;
export type ReplaceProductMediaInput = z.infer<typeof ReplaceProductMediaInputSchema>;
export type SearchProductsInput = z.infer<typeof SearchProductsInputSchema>;

// ---------------------------------------------------------------------------
// Store público (Fase 10) — filtros por whitelist, solo productos PUBLISHED.
// ---------------------------------------------------------------------------

export const StoreSearchProductsSchema = z.object({
  query: z.string().trim().min(1).max(160).optional(),
  categoryId: UuidSchema.optional(),
  brandId: UuidSchema.optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.number().int().min(1).max(48).default(24),
  sort: z.enum(["created_desc", "created_asc", "title_asc", "updated_desc"]).default("created_desc"),
}).strict();
export type StoreSearchProductsInput = z.infer<typeof StoreSearchProductsSchema>;

export const StoreProductBySlugSchema = z.object({
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
}).strict();
export type StoreProductBySlugInput = z.infer<typeof StoreProductBySlugSchema>;

export const StoreAutocompleteSchema = z.object({
  query: z.string().trim().min(2).max(80),
}).strict();
export type StoreAutocompleteInput = z.infer<typeof StoreAutocompleteSchema>;
