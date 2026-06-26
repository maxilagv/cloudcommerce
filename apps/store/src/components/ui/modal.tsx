"use client";

import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 w-full max-w-md rounded-t-cc-xl border border-cc-border bg-white shadow-cc-lg animate-[fadeSlideUp_200ms_ease-out] sm:rounded-cc-xl"
      >
        <header className="flex items-center justify-between border-b border-cc-border px-5 py-3.5">
          <h2 className="text-[15px] font-bold text-cc-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cc-focus-ring grid h-8 w-8 place-items-center rounded-cc-sm text-cc-muted transition-colors hover:bg-cc-soft hover:text-cc-text"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-cc-border px-5 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
