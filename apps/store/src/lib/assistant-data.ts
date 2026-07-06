import type { ProductCardData } from "@/lib/catalog-types";

export type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  /** Full mapped product cards to render inline (real catalog data). */
  products?: ProductCardData[];
  links?: { label: string; href: string }[];
};

export type QuickPrompt = {
  label: string;
  emoji: string;
  input: string;
};

/** Static quick actions offered by the CloudIA panel (UI affordance, not data). */
export const quickPrompts: QuickPrompt[] = [
  { label: "Ver ofertas", emoji: "🔥", input: "Ver ofertas" },
  { label: "Buscar producto", emoji: "🔍", input: "Buscar producto" },
  { label: "Comparar precios", emoji: "⚖️", input: "Comparar precios" },
  { label: "Mis pedidos", emoji: "📦", input: "Mis pedidos" },
];

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "ai",
  text: "¡Hola! Soy **CloudIA**, tu asistente de compras inteligente. Puedo ayudarte a encontrar el producto ideal, comparar precios o responder dudas. ¿En qué puedo ayudarte hoy?",
};

export function getWelcomeMessage(): ChatMessage {
  return welcomeMessage;
}
