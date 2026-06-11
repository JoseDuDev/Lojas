'use client'

import { useEffect, useState } from 'react'
import { api } from '../../../lib/api'

interface Stats {
  orders: number
  revenue: number
  products: number
  customers: number
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [usage, setUsage] = useState<any>(null)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { window.location.href = '/admin/login'; return }

    Promise.all([
      api.get('/orders?page=1', { token }),
      api.get('/plan/usage', { token }).catch(() => null),
    ]).then(([ordersData, usageData]) => {
      setOrders(ordersData)
      setUsage(usageData)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const revenue = orders
    .filter((o) => o.status === 'PAID' || o.status === 'DELIVERED')
    .reduce((acc, o) => acc + Number(o.total), 0)

  const cards = [
    { label: 'Pedidos', value: orders.length, icon: '🛍️' },
    { label: 'Receita', value: revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: '💰' },
    { label: 'Pagos', value: orders.filter((o) => o.status === 'PAID').length, icon: '✅' },
    { label: 'Pendentes', value: orders.filter((o) => o.status === 'PENDING').length, icon: '⏳' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {usage && usage.plan !== 'ENTERPRISE' && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Plano</span>
              <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2 py-1 rounded-full uppercase">
                {usage.plan}
              </span>
            </div>
            <a href="#" className="text-sm text-blue-600 hover:underline font-medium">
              Upgrade →
            </a>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                label: 'Produtos',
                current: usage.usage.products,
                max: usage.limits.productsPerStore,
                warning: usage.warnings.products,
              },
              {
                label: 'Lojas',
                current: usage.usage.stores,
                max: usage.limits.stores,
                warning: usage.warnings.stores,
              },
            ].map((item) => {
              const pct = item.max ? Math.min(100, Math.round((item.current / item.max) * 100)) : 0
              const barColor =
                pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{item.label}</span>
                    <span className="text-gray-500 tabular-nums">
                      {item.current}/{item.max ?? '∞'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {pct >= 100 && (
                    <p className="text-xs text-red-600 mt-1 font-medium">No limite — faça upgrade</p>
                  )}
                  {item.warning && pct < 100 && (
                    <p className="text-xs text-yellow-600 mt-1">⚠ {pct}% do limite</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 border">
            <p className="text-2xl mb-1">{card.icon}</p>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-sm text-gray-500">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b font-semibold">Últimos pedidos</div>
        {loading ? (
          <p className="p-6 text-gray-400">Carregando...</p>
        ) : orders.length === 0 ? (
          <p className="p-6 text-gray-400">Nenhum pedido ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Pedido', 'Cliente', 'Total', 'Status', 'Data'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 10).map((order) => (
                <tr key={order.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{order.id.slice(0, 8).toUpperCase()}</td>
                  <td className="px-4 py-3">{order.customer?.name || '—'}</td>
                  <td className="px-4 py-3 font-semibold">{Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium
                      ${order.status === 'PAID' ? 'bg-green-100 text-green-700' :
                        order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                        order.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-600'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{new Date(order.createdAt).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
