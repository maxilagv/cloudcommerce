"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Danger styling for destructive confirmations. */
  tone?: "default" | "danger";
  className?: string;
}

export function DialogContent({ title, description, children, footer, tone = "default", className }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ui-dialog__overlay" />
      <DialogPrimitive.Content className={cn("ui-dialog", tone === "danger" && "ui-dialog--danger", className)}>
        <div className="ui-dialog__head">
          <div>
            {title && <DialogPrimitive.Title className="ui-dialog__title">{title}</DialogPrimitive.Title>}
            {description && (
              <DialogPrimitive.Description className="ui-dialog__desc">{description}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="ui-icon-btn" aria-label="Cerrar">
            <X size={16} />
          </DialogPrimitive.Close>
        </div>
        <div className="ui-dialog__body">{children}</div>
        {footer && <div className="ui-dialog__foot">{footer}</div>}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
