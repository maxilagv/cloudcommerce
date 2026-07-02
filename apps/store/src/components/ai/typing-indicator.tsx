export function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      {/* CloudIA avatar */}
      <span className="h-7 w-7 shrink-0 rounded-full bg-[linear-gradient(180deg,#1374FF_0%,#005FEF_100%)] flex items-center justify-center text-white text-[11px] font-bold">
        ✦
      </span>
      <div className="flex items-center gap-1 bg-cc-bg-surface-soft rounded-[18px] rounded-bl-[4px] px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-cc-muted"
            style={{
              animation: `cc-typing-dot 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
