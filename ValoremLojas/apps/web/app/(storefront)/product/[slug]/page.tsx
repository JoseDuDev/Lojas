'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useCart } from '../../../../lib/cart'
import { api } from '../../../../lib/api'
import Image from 'next/image'

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<any>(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const addItem = useCart((s) => s.addItem)

  useEffect(() => {
    api.get(`/products/${slug}`).then(setProduct).catch(console.error)
  }, [slug])

  if (!product) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-400">Carregando...</div>
  }

  const image = product.images?.[0]?.url

  function handleAddToCart() {
    addItem({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      imageUrl: image,
      quantity: qty,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-10">
      {/* Imagem */}
      <div className="bg-gray-100 rounded-2xl overflow-hidden aspect-square relative">
        {image ? (
          <Image src={image} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl">📦</div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-4">
        {product.category && (
          <span className="text-sm text-gray-500 uppercase tracking-wide">{product.category.name}</span>
        )}
        <h1 className="text-3xl font-bold">{product.name}</h1>

        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-green-600">
            {Number(product.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          {product.comparePrice && (
            <span className="text-lg text-gray-400 line-through">
              {Number(product.comparePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          )}
        </div>

        {product.description && (
          <p className="text-gray-600 leading-relaxed">{product.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2">
          <label className="font-medium text-sm">Quantidade:</label>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200"
              onClick={() => setQty(Math.max(1, qty - 1))}
            >−</button>
            <span className="px-4 py-2 font-medium">{qty}</span>
            <button
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200"
              onClick={() => setQty(qty + 1)}
            >+</button>
          </div>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className="mt-4 py-3 px-6 rounded-xl text-white font-semibold text-lg transition
            bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {product.stock === 0 ? 'Sem estoque' : added ? '✓ Adicionado!' : 'Adicionar ao carrinho'}
        </button>

        <p className="text-sm text-gray-400">
          {product.stock > 0 ? `${product.stock} em estoque` : 'Produto esgotado'}
        </p>
      </div>
    </div>
  )
}
