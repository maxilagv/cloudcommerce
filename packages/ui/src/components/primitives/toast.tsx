"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "../../lib/cn";

export type ToastTone = "success" | "info" | "warning" | "error";

export interface ToastOptions {
  title: string;
  message?: string;
  tone?: ToastTone;
  /** ms before auto-dismiss; errors default to sticky (0). */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, "message" | "duration">> {
  id: number;
  message?: string;
  duration: number;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const ICONS = { success: Check, info: Info, warning: TriangleAlert, error: X } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, message, tone = "info", duration }: ToastOptions) => {
      const id = ++seq.current;
      const ms = duration ?? (tone === "error" ? 0 : 2600);
      setItems((prev) => [...prev, { id, title, message, tone, duration: ms }]);
      if (ms > 0) window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-toasts" role="region" aria-live="polite">
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div key={t.id} className={cn("ui-toast", `ui-toast--${t.tone}`)}>
              <span className="ui-toast__icon" aria-hidden>
                <Icon size={15} />
              </span>
              <div className="ui-toast__body">
                <b>{t.title}</b>
                {t.message && <div className="ui-toast__msg">{t.message}</div>}
              </div>
              <button className="ui-toast__close" onClick={() => dismiss(t.id)} aria-label="Cerrar">
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
