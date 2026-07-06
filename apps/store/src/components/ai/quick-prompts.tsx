import { quickPrompts, type QuickPrompt } from "@/lib/assistant-data";

export function QuickPrompts({ onSelect }: { onSelect: (input: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {quickPrompts.map((p: QuickPrompt) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onSelect(p.input)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-cc-border text-[12px] font-medium text-cc-secondary bg-cc-shell hover:border-cc-primary-border hover:text-cc-primary hover:bg-cc-primary-soft transition-all duration-[140ms] ease-cc-out"
        >
          <span>{p.emoji}</span>
          {p.label}
        </button>
      ))}
    </div>
  );
}
