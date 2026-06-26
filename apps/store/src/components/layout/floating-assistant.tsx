"use client";

import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { CloudIAPanel } from "@/components/ai/cloud-ia-panel";

export function FloatingAssistantButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <CloudIAPanel open={open} onClose={() => setOpen(false)} />

      <button
        type="button"
        aria-label={open ? "Cerrar asistente CloudIA" : "Abrir asistente CloudIA"}
        onClick={() => setOpen((v) => !v)}
        className={[
          "cc-focus-ring fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full",
          "bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] text-white",
          "transition-all duration-[200ms] ease-cc-out hover:scale-105 active:scale-95",
          open ? "shadow-[0_8px_24px_rgba(11,107,255,0.4)]" : "animate-cc-pulse",
        ].join(" ")}
      >
        <span
          className="transition-all duration-[200ms] ease-cc-out"
          style={{ transform: open ? "rotate(180deg) scale(0.9)" : "rotate(0deg) scale(1)" }}
        >
          {open ? (
            <X className="h-6 w-6" strokeWidth={2.2} />
          ) : (
            <Sparkles className="h-6 w-6" strokeWidth={2} />
          )}
        </span>
        {!open && (
          <span className="absolute right-[10px] top-[10px] h-[9px] w-[9px] rounded-full border-2 border-white bg-[#22C55E]" />
        )}
      </button>
    </>
  );
}
