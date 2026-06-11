'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { useCart } from '../../../../lib/cart'
import { api } from '../../../../lib/api'
import Image from 'next/image'

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<any>(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({})
  const addItem = useCart((s) => s.addItem)
  const addedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api.get(`/products/${slug}`).then(setProduct).catch(console.error)
  }, [slug])

  useEffect(() => {
    setSelectedValues({})
    setQty(1)
  }, [slug])

  const hasVariants = Boolean(product?.attributes?.length)

  const selectedVariant = useMemo(() => {
    if (!hasVariants || !product?.variants?.length) return null
    if (Object.keys(selectedValues).length < product.attributes.length) return null
    return (
      product.variants.find((v: any) =>
        v.attributeValues.every(
          (vav: any) => selectedValues[vav.attributeValue.attributeId] === vav.attributeValueId,
        ),
      ) ?? null
    )
  }, [product, selectedValues, hasVariants])

  const displayPrice = useMemo(() => {
    if (selectedVariant) return Number(selectedVariant.price)
    if (hasVariants && product?.variants?.length)
      return Math.min(...product.variants.map((v: any) => Number(v.price)))
    return product ? Number(product.price) : 0
  }, [product, selectedVariant, hasVariants])

  const displayStock = selectedVariant
    ? selectedVariant.stock
    : hasVariants
      ? null
      : (product?.stock ?? 0)

  const displayImages: any[] =
    selectedVariant?.images?.length ? selectedVariant.images : (product?.images ?? [])

  const image = displayImages[0]?.url

  const allSelected = !hasVariants || Object.keys(selectedValues).length === product?.attributes?.length
  const canAdd = allSelected && (displayStock ?? 0) > 0

  function handleAddToCart() {
    if (!product || !canAdd) return
    const variantLabel = selectedVariant
      ? ` (${selectedVariant.attributeValues.map((vav: any) => vav.attributeValue.value).join(' / ')})`
      : ''
    addItem({
      productId: product.id,
      variantId: selectedVariant?.id ?? null,
      name: product.name + variantLabel,
      price: displayPrice,
      imageUrl: image,
      quantity: qty,
    })
    setAdded(true)
    if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
    addedTimerRef.current = setTimeout(() => setAdded(false), 2000)
  }

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) clearTimeout(addedTimerRef.current)
    }
  }, [])

  if (!product) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-400">Carregando...</div>
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
            {hasVariants && !selectedVariant && (
              <span className="text-base font-normal text-gray-500 mr-1">A partir de</span>
            )}
            {displayPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          {(() => {
            const cp = selectedVariant
              ? selectedVariant.comparePrice
              : (!hasVariants ? product.comparePrice : null)
            return cp ? (
              <span className="text-lg text-gray-400 line-through">
                {Number(cp).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            ) : null
          })()}
        </div>

        {product.description && (
          <p className="text-gray-600 leading-relaxed">{product.description}</p>
        )}

        {/* Seletores de variante */}
        {hasVariants &&
          product.attributes.map((attr: any) => (
            <div key={attr.id}>
              <p className="text-sm font-medium mb-2">{attr.name}</p>
              <div className="flex flex-wrap gap-2">
                {attr.values.map((val: any) => {
                  const isSelected = selectedValues[attr.id] === val.id
                  const hasStock = product.variants.some((v: any) => {
                    if (v.stock <= 0) return false
                    const hasThisValue = v.attributeValues.some(
                      (vav: any) => vav.attributeValueId === val.id,
                    )
                    if (!hasThisValue) return false
                    for (const [otherAttrId, otherValueId] of Object.entries(selectedValues)) {
                      if (otherAttrId === attr.id) continue
                      const compatible = v.attributeValues.some(
                        (vav: any) => vav.attributeValueId === otherValueId,
                      )
                      if (!compatible) return false
                    }
                    return true
                  })
                  return (
                    <button
                      key={val.id}
                      disabled={!hasStock}
                      onClick={() =>
                        setSelectedValues((prev) => ({ ...prev, [attr.id]: val.id }))
                      }
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition
                        ${isSelected ? 'border-black bg-black text-white' : 'border-gray-300 hover:border-gray-500'}
                        ${!hasStock ? 'opacity-40 cursor-not-allowed line-through' : ''}`}
                    >
                      {val.value}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

        <div className="flex items-center gap-3 mt-2">
          <label className="font-medium text-sm">Quantidade:</label>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200"
              onClick={() => setQty(Math.max(1, qty - 1))}
            >
              −
            </button>
            <span className="px-4 py-2 font-medium">{qty}</span>
            <button
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200"
              onClick={() => setQty(qty + 1)}
            >
              +
            </button>
          </div>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={!canAdd}
          className="mt-4 py-3 px-6 rounded-xl text-white font-semibold text-lg transition
            bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {displayStock === null || !allSelected
            ? 'Selecione as opções'
            : displayStock === 0
              ? 'Sem estoque'
              : added
                ? '✓ Adicionado!'
                : 'Adicionar ao carrinho'}
        </button>

        {displayStock !== null && (
          <p className="text-sm text-gray-400">
            {displayStock > 0 ? `${displayStock} em estoque` : 'Produto esgotado'}
          </p>
        )}
      </div>
    </div>
  )
}
