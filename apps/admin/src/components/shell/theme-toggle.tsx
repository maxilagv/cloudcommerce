"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes only knows the theme after mount; avoid a hydration mismatch.
  useEffect(() => setMounted(true), []);
  const active = mounted ? (theme === "system" ? resolvedTheme : theme) : undefined;

  return (
    <div className="admin-theme-t" role="group" aria-label="Tema">
      <button type="button" data-on={active === "light" || undefined} aria-label="Claro" onClick={() => setTheme("light")}>
        <Sun size={15} />
      </button>
      <button type="button" data-on={active === "dark" || undefined} aria-label="Oscuro" onClick={() => setTheme("dark")}>
        <Moon size={15} />
      </button>
    </div>
  );
}
