import { headers } from 'next/headers'
import { api } from './api'

/**
 * Retorna o subdomínio (tenant) do request atual (Server Components)
 */
export function getTenant(): string {
  const headersList = headers()
  return headersList.get('x-tenant') || 'demo'
}

/**
 * Busca as informações públicas da loja (Server Component)
 */
export async function getStoreInfo(tenant: string) {
  try {
    return await api.get('/store', { tenant })
  } catch {
    return null
  }
}

/**
 * Busca produtos da loja
 */
export async function getProducts(tenant: string, query?: Record<string, string>) {
  const params = query ? '?' + new URLSearchParams(query).toString() : ''
  return api.get(`/products${params}`, { tenant })
}

/**
 * Busca produto por slug
 */
export async function getProduct(tenant: string, slug: string) {
  return api.get(`/products/${slug}`, { tenant })
}
