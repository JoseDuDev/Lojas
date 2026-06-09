import { create } from 'zustand'

export interface CartItem {
  productId: string
  name: string
  price: number
  imageUrl?: string
  quantity: number
}

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clear: () => void
  total: () => number
  count: () => number
}

export const useCart = create<CartStore>((set, get) => ({
  items: [],

  addItem: (newItem) => {
    set((state) => {
      const existing = state.items.find((i) => i.productId === newItem.productId)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === newItem.productId
              ? { ...i, quantity: i.quantity + newItem.quantity }
              : i,
          ),
        }
      }
      return { items: [...state.items, newItem] }
    })
  },

  removeItem: (productId) => {
    set((state) => ({ items: state.items.filter((i) => i.productId !== productId) }))
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId)
      return
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId ? { ...i, quantity } : i,
      ),
    }))
  },

  clear: () => set({ items: [] }),

  total: () => get().items.reduce((acc, i) => acc + i.price * i.quantity, 0),

  count: () => get().items.reduce((acc, i) => acc + i.quantity, 0),
}))
