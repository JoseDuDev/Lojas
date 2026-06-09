'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '../../../lib/api'

interface Hit {
  id: string
  name: string
  slug: string
  price: number
  comparePrice?: number | null
  stock: number
  imageUrl?: string | null
  categoryName?: string | null
  featured: boolean
  _formatted?: { name?: string; description?: string }
}

interface SearchResult {
  hits: Hit[]
  total: number
  query: string
  processingTimeMs?: number
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function SearchPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [inputValue, setInputValue] = useState(params.get('q') || '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const query = params.get('q') || ''
  const sort = params.get('sort') || ''

  useEffect(() => {
    setInputValue(query)
    if (query.trim().length === 0) { setResults(null); return }
    runSearch(query, sort)
  }, [query, sort])

  async function runSearch(q: string, s?: string) {
    setLoading(true)
    try {
      const p = new URLSearchParams({ q })
      if (s) p.set('sort', s)
      const data = await api.get<SearchResult>(`/search?${p}`)
      setResults(data)
    } catch {
      setResults({ hits: [], total: 0, query: q })
    } finally {
      setLoading(false)
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setInputValue(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams()
      if (val.trim()) p.set('q', val.trim())
      if (sort) p.set('sort', sort)
      router.push(`/search?${p}`)
    }, 400)
  }

  function handleSort(e: React.ChangeEvent<HTMLSelectElement>) {
    const p = new URLSearchParams()
    if (query) p.set('q', query)
    if (e.target.value) p.set('sort', e.target.value)
    router.push(`/search?${p}`)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Barra de busca */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            autoFocus
            className="w-full border rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Buscar produtos..."
            value={inputValue}
            onChange={handleInput}
          />
        </div>
        <select
          className="border rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black bg-white"
          value={sort}
          onChange={handleSort}
        >
          <option value="">Relevância</option>
          <option value="price:asc">Menor preço</option>
          <option value="price:desc">Maior preço</option>
        </select>
      </div>

      {/* Estado inicial */}
      {!query && !loading && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-sm">Digite o nome do produto que você procura</p>
        </div>
      )}

      {/* Carregando */}
      {loading && (
        <div className="text-center py-20">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {/* Resultados */}
      {!loading && results && (
        <>
          <p className="text-sm text-gray-400 mb-5">
            {results.total > 0
              ? `${results.total} resultado${results.total !== 1 ? 's' : ''} para "${results.query}"
                ${results.processingTimeMs ? ` · ${results.processingTimeMs}ms` : ''}`
              : `Nenhum resultado para "${results.query}"`}
          </p>

          {results.hits.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-3xl mb-3">😕</p>
              <p className="text-gray-500 text-sm mb-2">Nenhum produto encontrado.</p>
              <p className="text-gray-400 text-xs">Tente palavras-chave diferentes ou mais gerais.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {results.hits.map((hit) => (
                <Link key={hit.id} href={`/product/${hit.slug}`}
                  className="group border rounded-xl overflow-hidden hover:shadow-md transition">
                  {/* Imagem */}
                  <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                    {hit.imageUrl ? (
                      <img src={hit.imageUrl} alt={hit.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <span className="text-3xl">📦</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    {hit.categoryName && (
                      <p className="text-xs text-gray-400 mb-1">{hit.categoryName}</p>
                    )}
                    {/* Nome com highlight */}
                    <p className="text-sm font-medium leading-snug mb-2 line-clamp-2"
                      dangerouslySetInnerHTML={{
                        __html: hit._formatted?.name ?? hit.name,
                      }} />
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-base">{brl(hit.price)}</span>
                      {hit.comparePrice && hit.comparePrice > hit.price && (
                        <span className="text-xs text-gray-400 line-through">{brl(hit.comparePrice)}</span>
                      )}
                    </div>
                    {hit.stock === 0 && (
                      <span className="text-xs text-red-500 mt-1 block">Esgotado</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
