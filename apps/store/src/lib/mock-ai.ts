export type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  productIds?: string[];
  links?: { label: string; href: string }[];
};

export type QuickPrompt = {
  label: string;
  emoji: string;
  input: string;
};

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

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function respond(text: string, productIds?: string[], links?: { label: string; href: string }[]): ChatMessage {
  return { id: makeId(), role: "ai", text, productIds, links };
}

export function getWelcomeMessage(): ChatMessage {
  return welcomeMessage;
}

export async function getAiResponse(input: string): Promise<ChatMessage> {
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 600));

  const q = input.toLowerCase();

  if (q.includes("oferta") || q.includes("descuento") || q.includes("precio")) {
    return respond(
      "🔥 Estas son las mejores ofertas de esta semana que encontré para vos:",
      ["samsung-nevera", "samsung-qled-55", "apple-macbook-air-m2"],
    );
  }

  if (q.includes("nevera") || q.includes("refriger") || q.includes("heladera")) {
    return respond(
      "🧊 Encontré las mejores neveras disponibles. La Samsung Family Hub es la más popular esta semana:",
      ["samsung-nevera", "lg-lavadora"],
    );
  }

  if (q.includes("tv") || q.includes("televisor") || q.includes("pantalla") || q.includes("qled")) {
    return respond(
      "📺 Tenemos excelentes opciones en televisores. Te recomiendo el Samsung QLED 55\" — imagen 4K increíble:",
      ["samsung-qled-55"],
    );
  }

  if (q.includes("celular") || q.includes("smartphone") || q.includes("xiaomi") || q.includes("teléfono")) {
    return respond(
      "📱 En smartphones tenemos el Xiaomi 14 Ultra, uno de los mejores de la categoría:",
      ["xiaomi-14-ultra"],
    );
  }

  if (q.includes("macbook") || q.includes("laptop") || q.includes("computadora") || q.includes("notebook")) {
    return respond(
      "💻 Para trabajo y estudio, el MacBook Air M2 es imbatible en autonomía y performance:",
      ["apple-macbook-air-m2"],
    );
  }

  if (q.includes("auricular") || q.includes("audio") || q.includes("sonido") || q.includes("sony")) {
    return respond(
      "🎧 Los Sony WH-1000XM5 son los líderes en cancelación de ruido. Perfectos para trabajo remoto:",
      ["sony-wh1000xm5"],
    );
  }

  if (q.includes("comparar") || q.includes("compara")) {
    return respond(
      "⚖️ Para comparar productos, buscá los que te interesan en el catálogo y usá el botón **Comparar** en cada tarjeta. También podés decirme qué dos productos querés comparar y te cuento las diferencias clave.",
    );
  }

  if (q.includes("pedido") || q.includes("orden") || q.includes("compra") || q.includes("envío")) {
    return respond(
      "📦 Podés ver el estado de tus pedidos en tiempo real desde tu cuenta.",
      undefined,
      [
        { label: "Ver mis pedidos", href: "/orders" },
        { label: "Mi cuenta", href: "/account" },
      ],
    );
  }

  if (q.includes("buscar") || q.includes("encontrar") || q.includes("quiero") || q.includes("necesito")) {
    return respond(
      "🔍 ¡Cuéntame más! ¿Qué tipo de producto buscás? Por ejemplo: electrodomésticos, tecnología, audio, gaming... Dame más detalles y te ayudo a encontrar el ideal.",
    );
  }

  return respond(
    `Entiendo que buscás "${input}". Déjame mostrarte algunas opciones populares que podrían interesarte:`,
    ["samsung-nevera", "apple-macbook-air-m2", "sony-wh1000xm5"],
  );
}
