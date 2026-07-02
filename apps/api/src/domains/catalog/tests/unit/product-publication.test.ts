import { MediaSource, ProductStatus, StockStatus } from "@cloudcommerce/types";
import { describe, expect, it } from "vitest";
import {
  buildPublicationChecklist,
  publicationBlockingFailures,
} from "../../domain/policies/product-publication.js";
import type { ProductAggregate } from "../../domain/entities/catalog-entities.js";

const now = new Date("2026-07-01T00:00:00.000Z");

describe("product publication policy", () => {
  it("requires phase-2 catalog content before publishing", () => {
    const checklist = buildPublicationChecklist(productAggregate({ mainImageInGallery: false }), {
      hasPrice: false,
      stockStatus: StockStatus.OUT_OF_STOCK,
    });

    const failures = publicationBlockingFailures(checklist).map((item) => item.key);

    expect(failures).toContain("main_image");
    expect(failures).toContain("price");
    expect(failures).toContain("stock");
  });

  it("requires active phase-3 pricing and inventory for a complete catalog product", () => {
    const checklist = buildPublicationChecklist(productAggregate({ mainImageInGallery: true }), {
      hasPrice: false,
      stockStatus: StockStatus.OUT_OF_STOCK,
    });

    expect(publicationBlockingFailures(checklist).map((item) => item.key)).toEqual(["price", "stock"]);
  });

  it("passes blockers when catalog, pricing and inventory are complete", () => {
    const checklist = buildPublicationChecklist(productAggregate({ mainImageInGallery: true }), {
      hasPrice: true,
      stockStatus: StockStatus.IN_STOCK,
    });

    expect(publicationBlockingFailures(checklist)).toEqual([]);
  });
});

function productAggregate(input: { mainImageInGallery: boolean }): ProductAggregate {
  const mainImageId = "33333333-3333-4333-8333-333333333331";
  return {
    product: {
      id: "44444444-4444-4444-8444-444444444444",
      slug: "smartphone-demo",
      title: "Smartphone Demo",
      subtitle: null,
      description: "Descripcion suficientemente completa para publicar el producto demo.",
      brandId: "22222222-2222-4222-8222-222222222222",
      categoryId: "11111111-1111-4111-8111-111111111114",
      status: ProductStatus.READY_FOR_REVIEW,
      mainImageId,
      sku: "DEMO",
      seoTitle: "Smartphone Demo CloudCommerce",
      seoDescription: "Smartphone demo con informacion suficiente para SEO y publicacion.",
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
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
    brand: {
      id: "22222222-2222-4222-8222-222222222222",
      name: "Cloud Demo",
      slug: "cloud-demo",
      logoId: null,
      isActive: true,
    },
    mainImage: {
      id: mainImageId,
      storageKey: "seed/demo.png",
      mime: "image/png",
      byteSize: 68,
      width: 1,
      height: 1,
      dominantColor: null,
      blurPlaceholder: null,
      altText: null,
      source: MediaSource.UPLOAD,
      checksum: "checksum",
      createdBy: null,
      createdAt: now,
    },
    media: input.mainImageInGallery
      ? [
          {
            id: "55555555-5555-4555-8555-555555555555",
            productId: "44444444-4444-4444-8444-444444444444",
            mediaAssetId: mainImageId,
            position: 0,
            altText: null,
            asset: null,
          },
        ]
      : [],
    variants: [
      {
        id: "66666666-6666-4666-8666-666666666666",
        productId: "44444444-4444-4444-8444-444444444444",
        sku: "DEMO-BLK",
        title: "Negro",
        isActive: true,
        attributes: { color: "negro" },
        position: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
    specs: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        productId: "44444444-4444-4444-8444-444444444444",
        name: "General",
        position: 0,
        items: [
          {
            id: "88888888-8888-4888-8888-888888888881",
            specGroupId: "77777777-7777-4777-8777-777777777777",
            key: "screen",
            label: "Pantalla",
            valueText: "AMOLED",
            valueNum: null,
            unit: null,
            position: 0,
          },
          {
            id: "88888888-8888-4888-8888-888888888882",
            specGroupId: "77777777-7777-4777-8777-777777777777",
            key: "storage",
            label: "Almacenamiento",
            valueText: null,
            valueNum: 128,
            unit: "GB",
            position: 1,
          },
          {
            id: "88888888-8888-4888-8888-888888888883",
            specGroupId: "77777777-7777-4777-8777-777777777777",
            key: "battery",
            label: "Bateria",
            valueText: null,
            valueNum: 5000,
            unit: "mAh",
            position: 2,
          },
        ],
      },
    ],
  };
}
