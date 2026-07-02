"use client";

import { useState } from "react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { ARGENTINA_CITIES, DEFAULT_CITY } from "@/lib/constants";
import { useHydrated } from "@/hooks/use-hydrated";
import { useUi } from "@/store/ui";
import { toast } from "@/store/toast";
import { Modal } from "@/components/ui/modal";

export function LocationSelector() {
  const hydrated = useHydrated();
  const city = useUi((s) => s.city);
  const setCity = useUi((s) => s.setCity);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cc-focus-ring hidden shrink-0 items-center gap-1.5 rounded-cc-sm px-2 py-1.5 text-[13px] text-cc-secondary transition-colors duration-[140ms] ease-cc-out hover:bg-cc-soft hover:text-cc-text xl:flex"
      >
        <MapPin className="h-4 w-4 text-cc-primary" strokeWidth={2} />
        <span className="font-medium">Envios a {hydrated ? city : DEFAULT_CITY}</span>
        <ChevronDown className="h-3.5 w-3.5 text-cc-muted" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Elegi tu ciudad">
        <ul className="flex flex-col gap-0.5">
          {ARGENTINA_CITIES.map((c) => {
            const active = c === city;
            return (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => {
                    setCity(c);
                    toast.success("Ciudad actualizada", { description: c });
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-cc-sm px-3 py-2.5 text-[14px] transition-colors duration-[140ms]",
                    active
                      ? "bg-cc-primary-soft font-semibold text-cc-primary"
                      : "text-cc-secondary hover:bg-cc-soft hover:text-cc-text",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" strokeWidth={1.8} />
                    {c}
                  </span>
                  {active && <Check className="h-4 w-4" strokeWidth={2.4} />}
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>
    </>
  );
}
