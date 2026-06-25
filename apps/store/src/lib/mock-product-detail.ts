import type { ProductCardData } from "./mock-products";

export type ColorVariant = { id: string; label: string; hex: string };
export type CapacityVariant = { id: string; label: string };
export type SpecRow = { label: string; value: string };
export type SpecSection = { category: string; rows: SpecRow[] };
export type Review = {
  author: string;
  initials: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  helpful: number;
};

export type ProductDetailData = ProductCardData & {
  slug: string;
  images: string[];
  colorVariants: ColorVariant[];
  capacityVariants: CapacityVariant[];
  activeColor: string;
  activeCapacity: string;
  specs: SpecSection[];
  longDescription: string;
  descriptionBullets: string[];
  services: { icon: string; title: string; body: string }[];
  reviews: Review[];
  reviewDistribution: { stars: number; count: number }[];
  questions: { question: string; answer: string; date: string }[];
  breadcrumb: { label: string; href?: string }[];
};

export const mockProductDetail: ProductDetailData = {
  // Base ProductCardData fields
  id: "samsung-nevera-655l",
  slug: "samsung-nevera-655l",
  brand: "Samsung",
  name: "Nevera French Door Family Hub 655L",
  sku: "RF65DG960EB1/CO",
  image: "/products/samsung-nevera.svg",
  imageAlt: "Nevera Samsung Family Hub 655L Negro Intenso",
  badge: { type: "discount", label: "-11%" },
  rating: 4.8,
  reviewCount: 1247,
  features: ["Family Hub™ con pantalla 21.5\"", "Twin Cooling Plus™", "SpaceMax™ sin tuberías externas"],
  price: 7299900,
  oldPrice: 8199900,
  shipping: "free",
  stockStatus: "in-stock",
  isFavorite: false,

  // PDP-specific fields
  images: [
    "/products/samsung-nevera.svg",
    "/products/samsung-nevera.svg",
    "/products/samsung-nevera.svg",
    "/products/samsung-nevera.svg",
  ],

  colorVariants: [
    { id: "negro-intenso", label: "Negro Intenso", hex: "#0A0A0A" },
    { id: "plata-inox", label: "Plata Inox", hex: "#C8C8C8" },
    { id: "grafito", label: "Grafito", hex: "#4A4A4A" },
  ],
  activeColor: "negro-intenso",

  capacityVariants: [
    { id: "500l", label: "500 L" },
    { id: "590l", label: "590 L" },
    { id: "655l", label: "655 L" },
    { id: "720l", label: "720 L" },
  ],
  activeCapacity: "655l",

  breadcrumb: [
    { label: "Inicio", href: "/" },
    { label: "Catálogo", href: "/" },
    { label: "Electrodomésticos", href: "/" },
    { label: "Refrigeradores", href: "/" },
    { label: "Samsung", href: "/" },
    { label: "Samsung Family Hub 655L" },
  ],

  longDescription:
    "La Nevera Samsung Family Hub 655L redefine la cocina moderna. Con su pantalla táctil Family Hub™ de 21.5 pulgadas, puedes gestionar el contenido de tu nevera, reproducir música, ver recetas y conectarte con tu familia desde cualquier lugar. La tecnología Twin Cooling Plus™ mantiene dos zonas de temperatura independientes para que tus alimentos conserven su frescura hasta 3 veces más.",

  descriptionBullets: [
    "Pantalla táctil Family Hub™ 21.5\" con cámara interna y conectividad WiFi",
    "Twin Cooling Plus™: dos sistemas de enfriamiento independientes",
    "SpaceMax™: paredes más delgadas, más espacio interior sin aumentar el tamaño exterior",
    "Dispensador de agua y hielo con filtro Hygiene Fresh+™",
    "Iluminación LED interna de ultra bajo consumo",
    "Compresor Digital Inverter con garantía de 20 años",
    "Compatible con SmartThings para control desde tu smartphone",
  ],

  specs: [
    {
      category: "Dimensiones y Capacidad",
      rows: [
        { label: "Capacidad Total", value: "655 L" },
        { label: "Capacidad Refrigerador", value: "389 L" },
        { label: "Capacidad Congelador", value: "266 L" },
        { label: "Alto", value: "177.5 cm" },
        { label: "Ancho", value: "90.8 cm" },
        { label: "Fondo", value: "73.4 cm" },
        { label: "Peso", value: "121 kg" },
      ],
    },
    {
      category: "Refrigeración",
      rows: [
        { label: "Sistema de Enfriamiento", value: "Twin Cooling Plus™" },
        { label: "Tipo de Puerta", value: "French Door" },
        { label: "Dispensador", value: "Agua y hielo" },
        { label: "Compresor", value: "Digital Inverter" },
        { label: "Clasificación Energética", value: "A+ (Energy Star)" },
        { label: "Consumo Anual", value: "428 kWh/año" },
      ],
    },
    {
      category: "Tecnología y Conectividad",
      rows: [
        { label: "Pantalla", value: "Family Hub™ 21.5\" táctil" },
        { label: "Conectividad", value: "WiFi 802.11 b/g/n/ac" },
        { label: "Compatibilidad", value: "SmartThings, Bixby" },
        { label: "Voltaje", value: "127V / 60Hz" },
      ],
    },
  ],

  services: [
    {
      icon: "shield",
      title: "Garantía extendida 2 años",
      body: "Cobertura completa de fábrica más 1 año adicional CloudCommerce sin costo extra.",
    },
    {
      icon: "truck",
      title: "Instalación gratuita",
      body: "Técnico certificado Samsung instala y configura tu nevera en tu hogar sin costo adicional.",
    },
    {
      icon: "rotate",
      title: "Devolución 30 días",
      body: "Si no quedas satisfecho, recogemos el producto en tu puerta y realizamos el reembolso completo.",
    },
  ],

  reviews: [
    {
      author: "Carolina Martínez",
      initials: "CM",
      rating: 5,
      date: "hace 3 días",
      title: "Excelente nevera, superó mis expectativas",
      body: "La entrega fue rapidísima y el técnico instaló todo en menos de una hora. El Family Hub es increíble, vemos recetas mientras cocinamos. La temperatura se mantiene muy estable y los compartimentos son muy prácticos.",
      helpful: 34,
    },
    {
      author: "Andrés Felipe Torres",
      initials: "AT",
      rating: 5,
      date: "hace 1 semana",
      title: "La mejor inversión para la cocina",
      body: "Llevamos 3 semanas usándola y estamos encantados. El Twin Cooling mantiene las frutas y verduras frescas muchísimo más tiempo. El compresor es súper silencioso. La conectividad con SmartThings funciona perfectamente desde el celular.",
      helpful: 28,
    },
    {
      author: "Valentina Ospina",
      initials: "VO",
      rating: 4,
      date: "hace 2 semanas",
      title: "Muy buena, solo el precio es alto",
      body: "La calidad de construcción es excepcional y el diseño es hermoso en la cocina. El Family Hub tardó un poco en configurarse pero una vez listo funciona muy bien. Le doy 4 estrellas porque el precio es bastante elevado, aunque creo que vale la pena.",
      helpful: 19,
    },
  ],

  reviewDistribution: [
    { stars: 5, count: 923 },
    { stars: 4, count: 218 },
    { stars: 3, count: 67 },
    { stars: 2, count: 24 },
    { stars: 1, count: 15 },
  ],

  questions: [
    {
      question: "¿La nevera viene con instalación incluida o hay que contratar aparte?",
      answer:
        "Sí, la instalación está incluida sin costo adicional. Un técnico certificado Samsung coordina contigo para la visita dentro de las primeras 48 horas después de la entrega.",
      date: "hace 5 días",
    },
    {
      question: "¿El dispensador de agua necesita instalación de tubería o funciona con un depósito interno?",
      answer:
        "Funciona con ambas opciones. Puede conectarse a la tubería de agua de tu hogar (el técnico lo hace en la instalación) o usar el depósito interno removible de 3.5L que rellenas manualmente. La mayoría de nuestros clientes prefieren la conexión a tubería.",
      date: "hace 2 semanas",
    },
  ],
};

export const mockProductDetails: ProductDetailData[] = [mockProductDetail];

export function getProductBySlug(slug: string): ProductDetailData | undefined {
  return mockProductDetails.find((p) => p.slug === slug);
}
