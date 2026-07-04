import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Icon rendered inside the left edge (e.g. a search glass). */
  leadingIcon?: ReactNode;
  /** Adornment rendered inside the right edge (e.g. a currency symbol, a toggle). */
  trailing?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leadingIcon, trailing, invalid, className, ...props },
  ref,
) {
  const control = (
    <input
      ref={ref}
      className={cn("ui-input", leadingIcon && "ui-input--lead", invalid && "is-invalid", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );

  if (!leadingIcon && !trailing) return control;

  return (
    <span className="ui-input-wrap">
      {leadingIcon && <span className="ui-input__lead" aria-hidden>{leadingIcon}</span>}
      {control}
      {trailing && <span className="ui-input__trail">{trailing}</span>}
    </span>
  );
});
