"use client";

import * as Menu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

export interface DropdownMenuContentProps {
  children: ReactNode;
  align?: Menu.DropdownMenuContentProps["align"];
  className?: string;
}

export function DropdownMenuContent({ children, align = "end", className }: DropdownMenuContentProps) {
  return (
    <Menu.Portal>
      <Menu.Content align={align} sideOffset={6} className={cn("ui-menu", className)}>
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

export interface DropdownMenuItemProps extends Menu.DropdownMenuItemProps {
  tone?: "default" | "danger";
}

export function DropdownMenuItem({ tone = "default", className, ...props }: DropdownMenuItemProps) {
  return <Menu.Item className={cn("ui-menu__item", tone === "danger" && "ui-menu__item--danger", className)} {...props} />;
}

export function DropdownMenuSeparator() {
  return <Menu.Separator className="ui-menu__sep" />;
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  return <Menu.Label className="ui-menu__label">{children}</Menu.Label>;
}
