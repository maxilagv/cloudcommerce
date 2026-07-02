import { MediaSource, ProductStatus } from "@cloudcommerce/types";
import { relations, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { adminUser } from "./identity.js";

export const productStatusEnum = pgEnum("product_status", [
  ProductStatus.DRAFT,
  ProductStatus.READY_FOR_REVIEW,
  ProductStatus.PUBLISHED,
  ProductStatus.PAUSED,
  ProductStatus.ARCHIVED,
]);

export const mediaSourceEnum = pgEnum("media_source", [
  MediaSource.UPLOAD,
  MediaSource.AI,
  MediaSource.IMPORT,
]);

export const mediaAsset = pgTable(
  "media_asset",
  {
    id: uuid("id").primaryKey(),
    storageKey: text("storage_key").notNull(),
    mime: text("mime").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    dominantColor: text("dominant_color"),
    blurPlaceholder: text("blur_placeholder"),
    altText: text("alt_text"),
    source: mediaSourceEnum("source").notNull().default(MediaSource.UPLOAD),
    checksum: text("checksum").notNull(),
    createdBy: uuid("created_by").references(() => adminUser.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    storageKeyUnique: uniqueIndex("media_asset_storage_key_unique").on(table.storageKey),
    checksumUnique: uniqueIndex("media_asset_checksum_unique").on(table.checksum),
    createdByIdx: index("media_asset_created_by_idx").on(table.createdBy, table.createdAt),
    byteSizeCheck: check("media_asset_byte_size_positive", sql`${table.byteSize} > 0`),
  }),
);

export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey(),
    parentId: uuid("parent_id").references((): AnyPgColumn => category.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    imageId: uuid("image_id").references(() => mediaAsset.id, { onDelete: "set null" }),
    position: integer("position").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    parentPositionIdx: index("idx_categories_parent_pos").on(table.parentId, table.position),
    parentSlugUnique: uniqueIndex("category_parent_slug_unique").on(table.parentId, table.slug),
  }),
);

export const brand = pgTable(
  "brand",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logoId: uuid("logo_id").references(() => mediaAsset.id, { onDelete: "set null" }),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => ({
    slugUnique: uniqueIndex("brand_slug_unique").on(table.slug),
  }),
);

export const product = pgTable(
  "product",
  {
    id: uuid("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle"),
    description: text("description").notNull(),
    brandId: uuid("brand_id").references(() => brand.id, { onDelete: "set null" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => category.id, { onDelete: "restrict" }),
    status: productStatusEnum("status").notNull().default(ProductStatus.DRAFT),
    mainImageId: uuid("main_image_id").references(() => mediaAsset.id, { onDelete: "set null" }),
    sku: text("sku"),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => ({
    slugUnique: uniqueIndex("idx_products_slug").on(table.slug),
    statusCategoryIdx: index("idx_products_status_category").on(table.status, table.categoryId),
    categoryIdx: index("product_category_idx").on(table.categoryId),
    brandIdx: index("product_brand_idx").on(table.brandId),
    skuUnique: uniqueIndex("product_sku_unique").on(table.sku),
  }),
);

export const productMedia = pgTable(
  "product_media",
  {
    id: uuid("id").primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    mediaAssetId: uuid("media_asset_id")
      .notNull()
      .references(() => mediaAsset.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    altText: text("alt_text"),
  },
  (table) => ({
    productPositionIdx: index("idx_product_media_product_pos").on(table.productId, table.position),
    productPositionUnique: uniqueIndex("product_media_product_position_unique").on(table.productId, table.position),
    productAssetUnique: uniqueIndex("product_media_product_asset_unique").on(table.productId, table.mediaAssetId),
    positionCheck: check("product_media_position_range", sql`${table.position} >= 0 AND ${table.position} <= 5`),
  }),
);

export const productVariant = pgTable(
  "product_variant",
  {
    id: uuid("id").primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    title: text("title").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    productActiveIdx: index("idx_variants_product_active").on(table.productId, table.isActive),
    skuUnique: uniqueIndex("product_variant_sku_unique").on(table.sku),
  }),
);

export const specGroup = pgTable(
  "spec_group",
  {
    id: uuid("id").primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
  },
  (table) => ({
    productPositionIdx: index("spec_group_product_position_idx").on(table.productId, table.position),
  }),
);

export const specItem = pgTable(
  "spec_item",
  {
    id: uuid("id").primaryKey(),
    specGroupId: uuid("spec_group_id")
      .notNull()
      .references(() => specGroup.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    valueText: text("value_text"),
    valueNum: numeric("value_num"),
    unit: text("unit"),
    position: integer("position").notNull().default(0),
  },
  (table) => ({
    groupPositionIdx: index("spec_item_group_position_idx").on(table.specGroupId, table.position),
    valueCheck: check("spec_item_has_value", sql`${table.valueText} IS NOT NULL OR ${table.valueNum} IS NOT NULL`),
  }),
);

export const productSlugHistory = pgTable(
  "product_slug_history",
  {
    id: uuid("id").primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => product.id, { onDelete: "cascade" }),
    oldSlug: text("old_slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    oldSlugUnique: uniqueIndex("product_slug_history_old_slug_unique").on(table.oldSlug),
    productIdx: index("product_slug_history_product_idx").on(table.productId),
  }),
);

export const mediaAssetRelations = relations(mediaAsset, ({ one }) => ({
  createdByAdmin: one(adminUser, {
    fields: [mediaAsset.createdBy],
    references: [adminUser.id],
  }),
}));

export const categoryRelations = relations(category, ({ one, many }) => ({
  parent: one(category, {
    fields: [category.parentId],
    references: [category.id],
    relationName: "category_parent",
  }),
  children: many(category, { relationName: "category_parent" }),
  image: one(mediaAsset, {
    fields: [category.imageId],
    references: [mediaAsset.id],
  }),
  products: many(product),
}));

export const brandRelations = relations(brand, ({ one, many }) => ({
  logo: one(mediaAsset, {
    fields: [brand.logoId],
    references: [mediaAsset.id],
  }),
  products: many(product),
}));

export const productRelations = relations(product, ({ one, many }) => ({
  category: one(category, {
    fields: [product.categoryId],
    references: [category.id],
  }),
  brand: one(brand, {
    fields: [product.brandId],
    references: [brand.id],
  }),
  mainImage: one(mediaAsset, {
    fields: [product.mainImageId],
    references: [mediaAsset.id],
  }),
  variants: many(productVariant),
  media: many(productMedia),
  specGroups: many(specGroup),
  slugHistory: many(productSlugHistory),
}));

export const productMediaRelations = relations(productMedia, ({ one }) => ({
  product: one(product, {
    fields: [productMedia.productId],
    references: [product.id],
  }),
  asset: one(mediaAsset, {
    fields: [productMedia.mediaAssetId],
    references: [mediaAsset.id],
  }),
}));

export const productVariantRelations = relations(productVariant, ({ one }) => ({
  product: one(product, {
    fields: [productVariant.productId],
    references: [product.id],
  }),
}));

export const specGroupRelations = relations(specGroup, ({ one, many }) => ({
  product: one(product, {
    fields: [specGroup.productId],
    references: [product.id],
  }),
  items: many(specItem),
}));

export const specItemRelations = relations(specItem, ({ one }) => ({
  group: one(specGroup, {
    fields: [specItem.specGroupId],
    references: [specGroup.id],
  }),
}));
