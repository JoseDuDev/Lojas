import { getTenant, getProducts, getStoreInfo } from '../../lib/tenant'
import ProductCard from '../../components/storefront/ProductCard'

export default async function StorefrontHome() {
  const tenant = getTenant()
  const [store, products] = await Promise.all([
    getStoreInfo(tenant),
    getProducts(tenant).catch(() => []),
  ])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Banner da loja */}
      {store?.description && (
        <div
          className="rounded-2xl p-8 mb-10 text-white text-center"
          style={{ backgroundColor: store.primaryColor || '#000' }}
        >
          <h1 className="text-3xl font-bold">{store.name}</h1>
          <p className="mt-2 opacity-90">{store.description}</p>
        </div>
      )}

      {/* Grid de produtos */}
      <h2 className="text-2xl font-semibold mb-6">Produtos</h2>
      {products.length === 0 ? (
        <p className="text-gray-500">Nenhum produto disponível ainda.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product: any) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
