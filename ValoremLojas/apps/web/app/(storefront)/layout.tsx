import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getStoreInfo, getTenant } from '../../lib/tenant'
import StorefrontHeader from '../../components/storefront/Header'
import StorefrontFooter from '../../components/storefront/Footer'
import '../../app/globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const tenant = getTenant()
  const store = await getStoreInfo(tenant)
  return {
    title: store?.name || 'Loja Virtual',
    description: store?.description || '',
  }
}

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const tenant = getTenant()
  const store = await getStoreInfo(tenant)

  return (
    <html lang="pt-BR">
      <body>
        <StorefrontHeader store={store} />
        <main className="min-h-screen">{children}</main>
        <StorefrontFooter store={store} />
      </body>
    </html>
  )
}
