'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCart } from '../../lib/cart'

interface Props {
  store: {
    name?: string
    logoUrl?: string
    primaryColor?: string
  } | null
}

export default function StorefrontHeader({ store }: Props) {
  const count = useCart((s) => s.count())

  return (
    <header
      className="sticky top-0 z-50 border-b backdrop-blur-sm bg-white/90"
      style={{ borderColor: store?.primaryColor ? `${store.primaryColor}20` : undefined }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          {store?.logoUrl ? (
            <Image src={store.logoUrl} alt={store.name || 'Logo'} width={120} height={40} className="object-contain" />
          ) : (
            <span className="font-bold text-xl">{store?.name || 'Loja Virtual'}</span>
          )}
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/" className="text-sm font-medium hover:opacity-70">Produtos</Link>
          <Link href="/cart" className="relative text-sm font-medium hover:opacity-70">
            🛒 Carrinho
            {count > 0 && (
              <span className="absolute -top-2 -right-3 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  )
}
