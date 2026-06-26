import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProductCardData } from '@/lib/mock-products'

type WishlistStore = {
  items: ProductCardData[]
  isOpen: boolean
  toggle: (product: ProductCardData) => void
  has: (productId: string) => boolean
  remove: (productId: string) => void
  open: () => void
  close: () => void
}

export const useWishlist = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      toggle(product) {
        if (get().has(product.id)) {
          set({ items: get().items.filter((p) => p.id !== product.id) })
        } else {
          set({ items: [...get().items, product] })
        }
      },

      has(productId) {
        return get().items.some((p) => p.id === productId)
      },

      remove(productId) {
        set({ items: get().items.filter((p) => p.id !== productId) })
      },

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: 'cc-wishlist',
      partialize: (state) => ({ items: state.items }),
    },
  ),
)

export const useWishlistCount = () => useWishlist((s) => s.items.length)
