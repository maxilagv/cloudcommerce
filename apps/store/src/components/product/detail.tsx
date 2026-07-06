import { Breadcrumb } from "./breadcrumb";
import { ImageGallery } from "./image-gallery";
import { ProductInfo } from "./product-info";
import { PurchasePanel } from "./purchase-panel";
import { ContentTabs } from "./content-tabs";
import type { ProductDetailData } from "@/lib/product-detail-types";

export function ProductDetail({
  product,
  pointsPer1000 = 0,
}: {
  product: ProductDetailData;
  pointsPer1000?: number;
}) {
  return (
    <main id="producto" aria-labelledby="product-title" className="mx-auto max-w-[1440px] px-4 py-6">
      <Breadcrumb items={product.breadcrumb} />

      {/* Desktop 3-column (45% | 35% | 20%) */}
      <div
        className="mt-5 hidden lg:grid lg:items-start lg:gap-8"
        style={{ gridTemplateColumns: "45% 35% 20%" }}
      >
        <ImageGallery images={product.images} productName={product.name} />
        <ProductInfo product={product} pointsPer1000={pointsPer1000} />
        <aside className="sticky top-4">
          <PurchasePanel product={product} />
        </aside>
      </div>

      {/* Mobile/tablet: single column stack */}
      <div className="mt-5 flex flex-col gap-6 lg:hidden">
        <ImageGallery images={product.images} productName={product.name} />
        <ProductInfo product={product} pointsPer1000={pointsPer1000} />
        <PurchasePanel product={product} />
      </div>

      {/* Full-width content tabs */}
      <div className="mt-10">
        <ContentTabs product={product} />
      </div>
    </main>
  );
}
