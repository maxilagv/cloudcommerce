import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  invalid?: boolean;
}

/**
 * Styled native select. Native is the right default for short, known option
 * lists (categories, roles); swap for a Radix combobox where remote search is
 * needed (see SearchSelect, not yet built).
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, invalid, className, ...props },
  ref,
) {
  return (
    <span className="ui-select-wrap">
      <select ref={ref} className={cn("ui-select", invalid && "is-invalid", className)} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={15} className="ui-select__chev" aria-hidden />
    </span>
  );
});
