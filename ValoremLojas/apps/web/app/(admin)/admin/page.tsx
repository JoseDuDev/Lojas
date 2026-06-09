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

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { window.location.href = '/admin/login'; return }

    api.get('/orders?page=1', { token }).then(setOrders).catch(console.error).finally(() => setLoading(false))
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
