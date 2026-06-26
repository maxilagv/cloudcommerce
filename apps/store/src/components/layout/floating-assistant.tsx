"use client";

import { Sparkles } from "lucide-react";

export function FloatingAssistantButton() {
  return (
    <button
      type="button"
      aria-label="Abrir asistente CloudIA"
      className="cc-focus-ring animate-cc-pulse fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] text-white transition-transform duration-[160ms] ease-cc-out hover:scale-105 active:scale-95"
    >
      <Sparkles className="h-6 w-6" strokeWidth={2} />
      <span className="absolute right-[10px] top-[10px] h-[9px] w-[9px] rounded-full border-2 border-white bg-[#22C55E]" />
    </button>
  );
}
