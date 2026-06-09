'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '../../lib/cart'

interface Product {
  id: string
  name: string
  slug: string
  price: number
  comparePrice?: number
  images: { url: string }[]
  stock: number
}

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCart((s) => s.addItem)
  const image = product.images?.[0]?.url

  return (
    <div className="group border rounded-2xl overflow-hidden hover:shadow-md transition-shadow bg-white">
      <Link href={`/product/${product.slug}`}>
        <div className="aspect-square bg-gray-50 overflow-hidden relative">
          {image ? (
            <Image
              src={image}
              alt={product.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-200 text-5xl">📦</div>
          )}
        </div>
      </Link>

      <div className="p-4">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-medium text-sm leading-snug line-clamp-2 hover:underline">{product.name}</h3>
        </Link>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-bold text-green-600">
            {Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          {product.comparePrice && (
            <span className="text-xs text-gray-400 line-through">
              {Number(product.comparePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          )}
        </div>

        <button
          disabled={product.stock === 0}
          onClick={() =>
            addItem({
              productId: product.id,
              name: product.name,
              price: Number(product.price),
              imageUrl: image,
              quantity: 1,
            })
          }
          className="mt-3 w-full py-2 rounded-lg text-sm font-semibold bg-black text-white
            hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition"
        >
          {product.stock === 0 ? 'Esgotado' : 'Adicionar'}
        </button>
      </div>
    </div>
  )
}
