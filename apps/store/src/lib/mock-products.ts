/**
 * Local mock catalog data for the visual build.
 *
 * `ProductCardData` is the authoritative shape from
 * `.claude/Skills/tarjetas.md` §15 — kept verbatim. When the backend exists,
 * promote this type to `packages/types` and replace `mockProducts` with a
 * tRPC `product.list` query. Images are local placeholders in
 * `/public/products/*.svg` (swap for real photos later).
 */

export type ProductCardData = {
  id: string;
  brand: string;
  name: string;
  sku?: string;
  image: string;
  imageAlt: string;
  badge?: {
    type: "stock" | "discount" | "new" | "soon";
    label: string;
  };
  rating: number;
  reviewCount: number;
  features: string[];
  price: number;
  oldPrice?: number;
  shipping?: "free" | "paid" | "pickup";
  stockStatus: "in-stock" | "soon" | "out-of-stock";
  isFavorite?: boolean;
};

export const mockProducts: ProductCardData[] = [
  // ---- Reference row (tarjetas.md §16) ----
  {
    id: "samsung-nevera",
    brand: "Samsung",
    name: "Nevera Side by Side 655L",
    sku: "RS67A8811B1/CO",
    image: "/products/samsung-nevera.svg",
    imageAlt: "Nevera Samsung Side by Side 655L negra",
    badge: { type: "stock", label: "En stock" },
    rating: 4.8,
    reviewCount: 320,
    features: ["Tecnología SpaceMax™", "Twin Cooling Plus™", "Ahorro de energía"],
    price: 5299900,
    shipping: "free",
    stockStatus: "in-stock",
  },
  {
    id: "apple-macbook-air-m2",
    brand: "Apple",
    name: 'MacBook Air M2 13"',
    sku: "8GB – 256GB SSD",
    image: "/products/apple-macbook-air-m2.svg",
    imageAlt: "Apple MacBook Air M2 13 pulgadas",
    badge: { type: "new", label: "Nuevo" },
    rating: 4.9,
    reviewCount: 512,
    features: ["Chip Apple M2", "Hasta 18h de batería"],
    price: 5499900,
    shipping: "free",
    stockStatus: "in-stock",
  },
  {
    id: "lg-lavadora",
    brand: "LG",
    name: "Lavadora Carga Frontal 22kg",
    sku: "AI DD™ – FV22WV2S6S",
    image: "/products/lg-lavadora.svg",
    imageAlt: "Lavadora LG carga frontal 22kg",
    badge: { type: "stock", label: "En stock" },
    rating: 4.7,
    reviewCount: 198,
    features: ["Inteligencia Artificial AI DD™", "Ahorro de energía"],
    price: 2899900,
    shipping: "free",
    stockStatus: "in-stock",
  },
  {
    id: "xiaomi-14-ultra",
    brand: "Xiaomi",
    name: "Xiaomi 14 Ultra 5G",
    sku: "16GB – 512GB",
    image: "/products/xiaomi-14-ultra.svg",
    imageAlt: "Xiaomi 14 Ultra 5G",
    badge: { type: "discount", label: "-20%" },
    rating: 4.6,
    reviewCount: 274,
    features: ["Cámara Leica 50MP", "Carga rápida 90W"],
    price: 4499900,
    oldPrice: 5499900,
    shipping: "free",
    stockStatus: "in-stock",
  },
  // ---- Filler products to fill the grid ----
  {
    id: "sony-wh1000xm5",
    brand: "Sony",
    name: "Audífonos WH-1000XM5",
    sku: "WH1000XM5/B",
    image: "/products/sony-wh1000xm5.svg",
    imageAlt: "Audífonos Sony WH-1000XM5",
    badge: { type: "discount", label: "-15%" },
    rating: 4.8,
    reviewCount: 1240,
    features: ["Cancelación de ruido líder", "Hasta 30h de batería"],
    price: 1399900,
    oldPrice: 1649900,
    shipping: "free",
    stockStatus: "in-stock",
  },
  {
    id: "samsung-qled-55",
    brand: "Samsung",
    name: 'Smart TV QLED 55" 4K',
    sku: "QN55Q70C",
    image: "/products/samsung-qled-55.svg",
    imageAlt: "Samsung Smart TV QLED 55 pulgadas 4K",
    badge: { type: "stock", label: "En stock" },
    rating: 4.7,
    reviewCount: 487,
    features: ["Quantum Processor 4K", "Quantum HDR"],
    price: 3299900,
    shipping: "free",
    stockStatus: "in-stock",
  },
  {
    id: "sony-ps5",
    brand: "Sony",
    name: "Consola PlayStation 5 Slim",
    sku: "PS5-SLIM-1TB",
    image: "/products/sony-ps5.svg",
    imageAlt: "Consola Sony PlayStation 5 Slim",
    badge: { type: "soon", label: "Pronto" },
    rating: 4.9,
    reviewCount: 932,
    features: ["SSD ultrarrápido 1TB", "Gráficos 4K 120fps"],
    price: 2799900,
    shipping: "free",
    stockStatus: "soon",
  },
  {
    id: "apple-ipad-air",
    brand: "Apple",
    name: 'iPad Air 11" M2',
    sku: "MUWC3LL/A",
    image: "/products/apple-ipad-air.svg",
    imageAlt: "Apple iPad Air 11 pulgadas M2",
    badge: { type: "new", label: "Nuevo" },
    rating: 4.8,
    reviewCount: 356,
    features: ["Chip Apple M2", "Pantalla Liquid Retina"],
    price: 3199900,
    shipping: "free",
    stockStatus: "in-stock",
  },
  {
    id: "dyson-v15",
    brand: "Dyson",
    name: "Aspiradora V15 Detect",
    sku: "V15-DETECT",
    image: "/products/dyson-v15.svg",
    imageAlt: "Aspiradora Dyson V15 Detect",
    badge: { type: "discount", label: "-10%" },
    rating: 4.6,
    reviewCount: 421,
    features: ["Detección láser de polvo", "Hasta 60min de autonomía"],
    price: 2499900,
    oldPrice: 2799900,
    shipping: "free",
    stockStatus: "in-stock",
  },
  {
    id: "lg-microondas",
    brand: "LG",
    name: "Microondas NeoChef 42L",
    sku: "MJ4296OWS",
    image: "/products/lg-microondas.svg",
    imageAlt: "Microondas LG NeoChef 42 litros",
    badge: { type: "stock", label: "En stock" },
    rating: 4.5,
    reviewCount: 167,
    features: ["Tecnología Inverter Smart", "Revestimiento antibacterial"],
    price: 749900,
    shipping: "free",
    stockStatus: "in-stock",
  },
  {
    id: "samsung-galaxy-watch",
    brand: "Samsung",
    name: "Galaxy Watch 6 Classic",
    sku: "SM-R960",
    image: "/products/samsung-galaxy-watch.svg",
    imageAlt: "Samsung Galaxy Watch 6 Classic",
    badge: { type: "new", label: "Nuevo" },
    rating: 4.7,
    reviewCount: 289,
    features: ["Monitor de salud avanzado", "Bisel giratorio"],
    price: 1499900,
    shipping: "free",
    stockStatus: "in-stock",
  },
  {
    id: "jbl-charge5",
    brand: "JBL",
    name: "Parlante Charge 5 Portátil",
    sku: "JBLCHARGE5",
    image: "/products/jbl-charge5.svg",
    imageAlt: "Parlante JBL Charge 5 portátil",
    badge: { type: "discount", label: "-25%" },
    rating: 4.8,
    reviewCount: 1583,
    features: ["Resistente al agua IP67", "Hasta 20h de reproducción"],
    price: 599900,
    oldPrice: 799900,
    shipping: "free",
    stockStatus: "in-stock",
  },
];

// ---- Presentational facet data for the sidebar + chips (no backend) ----

export type CategoryNode = { label: string; count: number; active?: boolean };

export const categories: CategoryNode[] = [
  { label: "Electrónica", count: 1842, active: true },
  { label: "Computadoras", count: 624 },
  { label: "Celulares", count: 531 },
  { label: "Consolas", count: 188 },
  { label: "Audio y Video", count: 742 },
  { label: "Imagen", count: 309 },
  { label: "Electrodomésticos", count: 956 },
  { label: "Refrigeradores", count: 214 },
  { label: "Lavadoras", count: 176 },
];

export const brands: { label: string; count: number }[] = [
  { label: "Samsung", count: 412 },
  { label: "Apple", count: 287 },
  { label: "LG", count: 233 },
  { label: "Sony", count: 198 },
  { label: "Xiaomi", count: 164 },
  { label: "JBL", count: 91 },
];

export const ratingFilters = [5, 4, 3, 2] as const;

export const availabilityOptions: { id: string; label: string }[] = [
  { id: "in-stock", label: "En stock" },
  { id: "today", label: "Disponible hoy" },
  { id: "pickup", label: "Retiro en tienda" },
];

export const chips: string[] = [
  "Todo",
  "Recomendados",
  "Computadoras",
  "Celulares",
  "Consolas",
  "Audio y Video",
  "Imagen",
  "Electrodomésticos",
];

export const priceBounds = { min: 0, max: 8000000 };

export const totalResults = 4871;
