import type { LucideIcon } from "lucide-react";
import {
  Award,
  BadgeCheck,
  Gamepad2,
  Headphones,
  Home,
  Laptop,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Truck,
  Tv,
  WashingMachine,
  Wifi,
} from "lucide-react";
import { mockProducts } from "@/lib/mock-products";

export type HomeImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type HomeCategory = {
  id: string;
  title: string;
  description: string;
  href: string;
  image: HomeImage;
  icon: LucideIcon;
  accent: "blue" | "cyan" | "neutral";
};

export type HomeBenefit = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

export type HomePromo = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  image?: HomeImage;
  tone: "blue" | "light" | "glass" | "success";
};

export type HomeBrand = {
  id: string;
  name: string;
  href: string;
};

export type HomeFeaturedProduct = {
  id: string;
  name: string;
  brand: string;
  slug: string;
  image: HomeImage;
  price: number;
  listPrice?: number;
  rating?: {
    value: number;
    count: number;
  };
  badge?: "En stock" | "Nuevo" | "Oferta" | "Destacado";
  href: string;
};

export type HomeCollection = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  image: HomeImage;
};

export const heroProducts = [
  {
    id: "tv",
    src: "/products/samsung-qled-55.svg",
    alt: "Smart TV destacado en cloudcommerce",
    className: "left-[18%] top-[7%] w-[46%] rotate-[-1deg]",
  },
  {
    id: "fridge",
    src: "/products/samsung-nevera.svg",
    alt: "Heladera premium destacada en cloudcommerce",
    className: "right-[5%] top-[16%] w-[27%]",
  },
  {
    id: "washer",
    src: "/products/lg-lavadora.svg",
    alt: "Lavarropas frontal destacado en cloudcommerce",
    className: "right-[26%] bottom-[2%] w-[24%]",
  },
  {
    id: "laptop",
    src: "/products/apple-macbook-air-m2.svg",
    alt: "Notebook premium destacada en cloudcommerce",
    className: "left-[5%] bottom-[8%] w-[32%]",
  },
  {
    id: "phone",
    src: "/products/xiaomi-14-ultra.svg",
    alt: "Smartphone destacado en cloudcommerce",
    className: "left-[41%] bottom-[8%] w-[15%]",
  },
] as const;

export const homeHeroCopy = {
  eyebrow: "TECNOLOGIA QUE TE MUEVE",
  title: "Tecnologia que mejora tu vida en casa",
  description:
    "Descubri electronica y electrodomesticos premium con envio rapido, garantia oficial y atencion experta.",
  primaryCta: "Descubrir ofertas",
  secondaryCta: "Ver categorias",
};

export const homeBenefits: HomeBenefit[] = [
  { id: "shipping", title: "Envios rapidos 24-48h", description: "A todo el pais", icon: Truck },
  { id: "safe", title: "Compra 100% segura", description: "Tus datos protegidos", icon: ShieldCheck },
  { id: "warranty", title: "Garantia oficial", description: "Productos originales", icon: BadgeCheck },
  { id: "returns", title: "Devoluciones faciles", description: "Hasta 30 dias", icon: RotateCcw },
  { id: "support", title: "Soporte experto 24/7", description: "Estamos para ayudarte", icon: Headphones },
];

export const homeCategories: HomeCategory[] = [
  {
    id: "celulares",
    title: "Celulares",
    description: "Smartphones y wearables",
    href: "/products?category=Celulares",
    image: { src: "/products/xiaomi-14-ultra.svg", alt: "Celulares destacados en cloudcommerce", width: 320, height: 320 },
    icon: Smartphone,
    accent: "blue",
  },
  {
    id: "electrodomesticos",
    title: "Electrodomesticos",
    description: "Equipos para tu hogar",
    href: "/products?category=Electrodomesticos",
    image: { src: "/products/samsung-nevera.svg", alt: "Electrodomesticos para el hogar", width: 320, height: 320 },
    icon: WashingMachine,
    accent: "neutral",
  },
  {
    id: "tv-audio",
    title: "TV y Audio",
    description: "Entretenimiento inmersivo",
    href: "/products?category=Imagen",
    image: { src: "/products/samsung-qled-55.svg", alt: "TV y audio para entretenimiento en casa", width: 320, height: 320 },
    icon: Tv,
    accent: "cyan",
  },
  {
    id: "computadores",
    title: "Computadores",
    description: "Trabajo, estudio y creacion",
    href: "/products?category=Computadoras",
    image: { src: "/products/apple-macbook-air-m2.svg", alt: "Computadores para trabajo y estudio", width: 320, height: 320 },
    icon: Laptop,
    accent: "blue",
  },
  {
    id: "hogar-inteligente",
    title: "Hogar Inteligente",
    description: "Casa conectada y eficiente",
    href: "/products?category=Aspiradoras",
    image: { src: "/products/dyson-v15.svg", alt: "Dispositivos de hogar inteligente", width: 320, height: 320 },
    icon: Wifi,
    accent: "neutral",
  },
  {
    id: "accesorios",
    title: "Accesorios",
    description: "Audio, energia y movilidad",
    href: "/products?category=Audio%20y%20Video",
    image: { src: "/products/sony-wh1000xm5.svg", alt: "Accesorios tecnologicos destacados", width: 320, height: 320 },
    icon: Headphones,
    accent: "cyan",
  },
];

export const homeBrands: HomeBrand[] = [
  "Samsung",
  "Apple",
  "LG",
  "Xiaomi",
  "Philips",
  "Motorola",
  "Bose",
  "Intel",
  "Sony",
].map((name) => ({ id: name.toLowerCase(), name, href: `/products?brand=${encodeURIComponent(name)}` }));

export const homePromos: HomePromo[] = [
  {
    id: "deal",
    eyebrow: "Mega ofertas",
    title: "Hasta 40% OFF",
    description: "En productos seleccionados de tecnologia y hogar.",
    href: "/products?sort=price-asc",
    cta: "Comprar ahora",
    image: { src: "/products/jbl-charge5.svg", alt: "Parlante destacado en oferta", width: 320, height: 320 },
    tone: "blue",
  },
  {
    id: "arrivals",
    eyebrow: "Nuevos lanzamientos",
    title: "Lo ultimo en tecnologia",
    description: "Dispositivos recien llegados para actualizar tu setup.",
    href: "/products?sort=newest",
    cta: "Explorar novedades",
    image: { src: "/products/apple-ipad-air.svg", alt: "Tablet destacada como nuevo lanzamiento", width: 320, height: 320 },
    tone: "light",
  },
  {
    id: "shipping",
    eyebrow: "Entrega inteligente",
    title: "Seguimiento en tiempo real",
    description: "Conoce el estado de tus envios desde tu cuenta.",
    href: "/orders",
    cta: "Ver seguimiento",
    tone: "glass",
  },
  {
    id: "protected",
    eyebrow: "Compra protegida",
    title: "Seguridad y garantia oficial",
    description: "Productos originales, devoluciones simples y soporte experto.",
    href: "/products",
    cta: "Conocer productos",
    tone: "success",
  },
];

const badgeByType = {
  stock: "En stock",
  new: "Nuevo",
  discount: "Oferta",
  soon: "Destacado",
} as const;

export const homeFeaturedProducts: HomeFeaturedProduct[] = mockProducts.slice(0, 6).map((product) => ({
  id: product.id,
  name: product.name,
  brand: product.brand,
  slug: product.id,
  image: { src: product.image, alt: product.imageAlt, width: 320, height: 320 },
  price: product.price,
  listPrice: product.oldPrice,
  rating: { value: product.rating, count: product.reviewCount },
  badge: product.badge ? badgeByType[product.badge.type] : "Destacado",
  href: `/products/${product.id}`,
}));

export const homeCollections: HomeCollection[] = [
  {
    id: "gaming",
    title: "Gaming",
    description: "Consolas, pantallas y audio para jugar mejor.",
    href: "/products?collection=gaming",
    icon: Gamepad2,
    image: { src: "/products/sony-ps5.svg", alt: "Productos gaming destacados", width: 320, height: 320 },
  },
  {
    id: "office",
    title: "Trabajo y oficina",
    description: "Notebooks y tablets para productividad diaria.",
    href: "/products?collection=oficina",
    icon: Laptop,
    image: { src: "/products/apple-macbook-air-m2.svg", alt: "Setup para trabajo y oficina", width: 320, height: 320 },
  },
  {
    id: "connected-home",
    title: "Casa conectada",
    description: "Electrodomesticos y dispositivos para vivir mejor.",
    href: "/products?collection=casa-conectada",
    icon: Home,
    image: { src: "/products/lg-lavadora.svg", alt: "Productos para casa conectada", width: 320, height: 320 },
  },
];

export const homeTrustItems: HomeBenefit[] = [
  { id: "customers", title: "+120K clientes satisfechos", description: "Confianza que nos impulsa", icon: Award },
  { id: "official", title: "Garantia oficial", description: "Productos originales", icon: PackageCheck },
  { id: "brands", title: "Marcas lideres", description: "Las mejores marcas", icon: Sparkles },
  { id: "safe", title: "Compra 100% segura", description: "Tus datos protegidos", icon: ShieldCheck },
  { id: "invoice", title: "Factura A disponible", description: "Solicitala en tu compra", icon: ReceiptText },
];
