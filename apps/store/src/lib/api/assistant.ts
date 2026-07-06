import type { ChatMessage } from "@/lib/assistant-data";
import type { ProductCardData } from "@/lib/catalog-types";
import { autocompleteProducts, getStoreProducts } from "./catalog";

/**
 * CloudIA assistant backed by the real catalog: resolves the user's message
 * against `store.products.autocomplete` and falls back to `store.products.list`.
 */

function makeId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function respond(
  text: string,
  products?: ProductCardData[],
  links?: { label: string; href: string }[],
): ChatMessage {
  return { id: makeId(), role: "ai", text, products, links };
}

export async function getAiResponse(input: string): Promise<ChatMessage> {
  const q = input.trim();
  const lower = q.toLowerCase();

  if (lower.includes("pedido") || lower.includes("orden") || lower.includes("envío") || lower.includes("envio")) {
    return respond(
      "Podés ver el estado de tus pedidos en tiempo real desde tu cuenta.",
      undefined,
      [
        { label: "Ver mis pedidos", href: "/orders" },
        { label: "Mi cuenta", href: "/account" },
      ],
    );
  }

  if (lower.includes("comparar") || lower.includes("compara")) {
    return respond(
      "Para comparar productos, buscá los que te interesan en el catálogo y usá el botón **Comparar** en cada tarjeta. También podés decirme qué producto buscás y te muestro opciones.",
      undefined,
      [{ label: "Ir al catálogo", href: "/products" }],
    );
  }

  // 1) Autocomplete (needs at least 2 chars), 2) full-text list as fallback.
  let matches: ProductCardData[] = q.length >= 2 ? await autocompleteProducts(q) : [];
  if (matches.length === 0 && q.length >= 2) {
    matches = (await getStoreProducts({ query: q, limit: 4 })).slice(0, 4);
  }
  if (matches.length === 0 && q.length < 2) {
    matches = (await getStoreProducts({ limit: 4 })).slice(0, 4);
  }

  if (matches.length > 0) {
    return respond("Encontré estos productos que pueden servirte:", matches.slice(0, 4));
  }

  return respond(
    "No encontré productos para eso. Probá con otra palabra o mirá el catálogo.",
    undefined,
    [{ label: "Ver catálogo", href: "/products" }],
  );
}
