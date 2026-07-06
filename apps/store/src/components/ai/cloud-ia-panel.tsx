"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Sparkles } from "lucide-react";
import { ChatMessageBubble } from "./chat-message";
import { TypingIndicator } from "./typing-indicator";
import { QuickPrompts } from "./quick-prompts";
import { getWelcomeMessage, type ChatMessage } from "@/lib/assistant-data";
import { getAiResponse } from "@/lib/api/assistant";

export function CloudIAPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([getWelcomeMessage()]);
  const [isTyping, setIsTyping] = useState(false);
  const [input, setInput] = useState("");
  const [showPrompts, setShowPrompts] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    setShowPrompts(false);
    setInput("");

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    const aiMsg = await getAiResponse(trimmed);
    setIsTyping(false);
    setMessages((prev) => [...prev, aiMsg]);
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-transparent"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={[
          "fixed bottom-[88px] right-6 z-50 flex flex-col overflow-hidden",
          "w-[min(460px,calc(100vw-1.5rem))] h-[min(600px,calc(100vh-120px))]",
          "bg-cc-shell border border-cc-border-subtle rounded-[22px] shadow-[0_24px_64px_rgba(11,107,255,0.14),0_8px_24px_rgba(0,0,0,0.08)]",
          "transition-all duration-[280ms] ease-cc-out",
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-6 pointer-events-none",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-cc-border-subtle bg-[linear-gradient(135deg,#EAF3FF_0%,#F0F7FF_100%)] shrink-0">
          <div className="h-9 w-9 rounded-full bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] flex items-center justify-center text-white shrink-0">
            <Sparkles className="h-4.5 w-4.5" strokeWidth={2} />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-cc-text leading-tight">CloudIA</p>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#22C55E]" />
              <span className="text-[11px] text-cc-muted font-medium">En línea · Responde al instante</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente"
            className="h-8 w-8 rounded-full flex items-center justify-center text-cc-muted hover:text-cc-text hover:bg-cc-bg-hover transition-colors duration-[140ms] cc-focus-ring"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 cc-no-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="animate-[fadeSlideUp_220ms_ease-out_both]"
            >
              <ChatMessageBubble message={msg} />
            </div>
          ))}

          {isTyping && (
            <div className="animate-[fadeSlideUp_220ms_ease-out_both]">
              <TypingIndicator />
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick prompts (first interaction only) */}
        {showPrompts && !isTyping && (
          <div className="shrink-0 border-t border-cc-border-subtle pt-3">
            <p className="px-4 text-[11px] text-cc-muted font-medium mb-2">Acciones rápidas</p>
            <QuickPrompts onSelect={handleSend} />
          </div>
        )}

        {/* Input */}
        <div className="shrink-0 border-t border-cc-border-subtle px-3 py-3">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="flex items-center gap-2 bg-cc-bg-surface-soft rounded-full px-4 py-2 border border-cc-border hover:border-cc-primary-border transition-colors duration-[140ms] focus-within:border-cc-primary focus-within:shadow-[0_0_0_3px_rgba(11,107,255,0.10)]"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Preguntame algo…"
              disabled={isTyping}
              className="flex-1 bg-transparent text-[13px] text-cc-text placeholder:text-cc-faint outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              aria-label="Enviar"
              className="h-7 w-7 rounded-full bg-cc-primary flex items-center justify-center text-white disabled:opacity-40 hover:bg-cc-primary-hover transition-colors duration-[140ms] shrink-0"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </form>
          <p className="text-center text-[10px] text-cc-faint mt-1.5">
            CloudIA puede cometer errores. Verificá precios en el catálogo.
          </p>
        </div>
      </div>
    </>
  );
}
