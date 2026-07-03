"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/cn.js";

export interface SwitchProps extends SwitchPrimitive.SwitchProps {
  className?: string;
}

export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root className={cn("ui-switch", className)} {...props}>
      <SwitchPrimitive.Thumb className="ui-switch__thumb" />
    </SwitchPrimitive.Root>
  );
}
