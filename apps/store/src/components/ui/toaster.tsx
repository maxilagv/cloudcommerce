"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast, type ToastVariant } from "@/store/toast";

const VARIANTS: Record<
  ToastVariant,
  { icon: typeof Info; iconClass: string; ring: string }
> = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-cc-success",
    ring: "before:bg-cc-success",
  },
  error: {
    icon: AlertCircle,
    iconClass: "text-cc-danger",
    ring: "before:bg-cc-danger",
  },
  info: {
    icon: Info,
    iconClass: "text-cc-primary",
    ring: "before:bg-cc-primary",
  },
};

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-[360px] flex-col gap-2 sm:right-6 sm:top-6">
      {toasts.map((t) => {
        const v = VARIANTS[t.variant];
        const Icon = v.icon;
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-cc-md border border-cc-border bg-white p-3.5 pl-4 shadow-cc-lg",
              "animate-[fadeSlideUp_220ms_ease-out]",
              "before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
              v.ring,
            )}
          >
            <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", v.iconClass)} strokeWidth={2} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-cc-text">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-[12px] text-cc-muted line-clamp-2">
                  {t.description}
                </p>
              )}
              {t.actionLabel && t.onAction && (
                <button
                  type="button"
                  onClick={() => {
                    t.onAction?.();
                    dismiss(t.id);
                  }}
                  className="mt-1.5 text-[12px] font-semibold text-cc-primary hover:underline"
                >
                  {t.actionLabel}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Cerrar notificación"
              className="cc-focus-ring -mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-cc-sm text-cc-muted transition-colors hover:bg-cc-soft hover:text-cc-text"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
