export type ProductImage = {
  url: string
  alt: string
}

export type ProductVariant = {
  label: string
  value: string
  available: boolean
}

export type Product = {
  id: string
  slug: string
  name: string
  brand: string
  description: string
  price: number
  originalPrice?: number
  images: ProductImage[]
  rating: number
  reviewCount: number
  features: string[]
  inStock: boolean
  stockCount?: number
  isNew?: boolean
  freeShipping?: boolean
  category: string
  subcategory?: string
  sku: string
  variants?: {
    colors?: ProductVariant[]
    sizes?: ProductVariant[]
  }
  tags?: string[]
}

export type CartItem = {
  product: Product
  quantity: number
}
