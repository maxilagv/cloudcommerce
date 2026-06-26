import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProductCardData } from '@/lib/mock-products'

export type CartItem = {
  product: ProductCardData
  quantity: number
}

type CartStore = {
  items: CartItem[]
  isOpen: boolean
  add: (product: ProductCardData, quantity?: number) => void
  remove: (productId: string) => void
  setQuantity: (productId: string, qty: number) => void
  clear: () => void
  open: () => void
  close: () => void
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      add(product, quantity = 1) {
        const existing = get().items.find((i) => i.product.id === product.id)
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.product.id === product.id
                ? { ...i, quantity: i.quantity + quantity }
                : i,
            ),
            isOpen: true,
          })
        } else {
          set({ items: [...get().items, { product, quantity }], isOpen: true })
        }
      },

      remove(productId) {
        set({ items: get().items.filter((i) => i.product.id !== productId) })
      },

      setQuantity(productId, qty) {
        if (qty <= 0) {
          get().remove(productId)
          return
        }
        set({
          items: get().items.map((i) =>
            i.product.id === productId ? { ...i, quantity: qty } : i,
          ),
        })
      },

      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
    }),
    {
      name: 'cc-cart',
      partialize: (state) => ({ items: state.items }),
    },
  ),
)

export const useCartCount = () =>
  useCart((s) => s.items.reduce((acc, i) => acc + i.quantity, 0))

export const useCartTotal = () =>
  useCart((s) =>
    s.items.reduce((acc, i) => acc + i.product.price * i.quantity, 0),
  )
