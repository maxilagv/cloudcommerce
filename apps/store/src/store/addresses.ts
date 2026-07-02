"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { mockAddresses, type Address } from "@/lib/mock-account";

type AddressInput = Omit<Address, "id">;

type AddressesStore = {
  addresses: Address[];
  add: (a: AddressInput) => void;
  update: (id: string, patch: Partial<AddressInput>) => void;
  remove: (id: string) => void;
  setPrimary: (id: string) => void;
};

let seq = 0;
const newId = () => `addr-${Date.now().toString(36)}-${seq++}`;

/**
 * Seeded from mock data via the initial state: a first-time visitor sees the
 * seeds; once persisted (even to an empty list) the stored value wins, so an
 * intentionally-emptied list is respected. Gate UI on `useHydrated()`.
 */
export const useAddresses = create<AddressesStore>()(
  persist(
    (set) => ({
      addresses: mockAddresses,
      add: (a) =>
        set((s) => {
          const addr: Address = { ...a, id: newId() };
          const list = [...s.addresses, addr];
          return {
            addresses: addr.isPrimary
              ? list.map((x) => (x.id === addr.id ? x : { ...x, isPrimary: false }))
              : list,
          };
        }),
      update: (id, patch) =>
        set((s) => {
          const settingPrimary = patch.isPrimary === true;
          return {
            addresses: s.addresses.map((x) => {
              if (x.id === id) return { ...x, ...patch };
              return settingPrimary ? { ...x, isPrimary: false } : x;
            }),
          };
        }),
      remove: (id) => set((s) => ({ addresses: s.addresses.filter((x) => x.id !== id) })),
      setPrimary: (id) =>
        set((s) => ({ addresses: s.addresses.map((x) => ({ ...x, isPrimary: x.id === id })) })),
    }),
    { name: "cc-addresses", partialize: (s) => ({ addresses: s.addresses }) },
  ),
);
