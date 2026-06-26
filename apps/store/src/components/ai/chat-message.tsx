import Link from "next/link";
import { AiMiniCard } from "./ai-mini-card";
import type { ChatMessage } from "@/lib/mock-ai";

function parseMarkdown(text: string) {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-[18px] rounded-br-[4px] bg-cc-primary px-4 py-2.5 text-[13px] text-white leading-snug">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2">
      {/* CloudIA avatar */}
      <span className="h-7 w-7 shrink-0 rounded-full bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] flex items-center justify-center text-white text-[11px] font-bold">
        ✦
      </span>

      <div className="flex flex-col gap-2 max-w-[85%]">
        {/* Text bubble */}
        <div
          className="rounded-[18px] rounded-bl-[4px] bg-cc-bg-surface-soft px-4 py-2.5 text-[13px] text-cc-text leading-relaxed"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(message.text) }}
        />

        {/* Inline product cards */}
        {message.productIds && message.productIds.length > 0 && (
          <div className="flex flex-col gap-2">
            {message.productIds.map((id) => (
              <AiMiniCard key={id} productId={id} />
            ))}
          </div>
        )}

        {/* Action links */}
        {message.links && message.links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex items-center px-3 py-1.5 rounded-full border border-cc-primary-border text-[12px] font-semibold text-cc-primary bg-cc-primary-soft hover:bg-cc-primary hover:text-white transition-colors duration-[140ms] ease-cc-out"
              >
                {link.label} →
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
