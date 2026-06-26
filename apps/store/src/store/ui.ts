"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_CITY } from "@/lib/constants";

type UiStore = {
  city: string;
  setCity: (city: string) => void;
};

/** Misc persisted UI preferences (delivery city for now). */
export const useUi = create<UiStore>()(
  persist(
    (set) => ({
      city: DEFAULT_CITY,
      setCity: (city) => set({ city }),
    }),
    { name: "cc-ui" },
  ),
);
