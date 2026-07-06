"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductCardData } from "@/lib/catalog-types";
import { toast } from "./toast";

export const COMPARE_MAX = 4;

type CompareStore = {
  items: ProductCardData[];
  isOpen: boolean;
  toggle: (product: ProductCardData) => void;
  has: (id: string) => boolean;
  remove: (id: string) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
};

export const useCompare = create<CompareStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      toggle: (product) => {
        const exists = get().items.some((x) => x.id === product.id);
        if (exists) {
          set({ items: get().items.filter((x) => x.id !== product.id) });
          toast.info("Quitado del comparador", { description: product.name });
          return;
        }
        if (get().items.length >= COMPARE_MAX) {
          toast.error(`Podés comparar hasta ${COMPARE_MAX} productos`);
          return;
        }
        set({ items: [...get().items, product] });
        toast.success("Agregado al comparador", { description: product.name });
      },
      has: (id) => get().items.some((x) => x.id === id),
      remove: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    { name: "cc-compare", partialize: (s) => ({ items: s.items }) },
  ),
);

export const useCompareCount = () => useCompare((s) => s.items.length);
