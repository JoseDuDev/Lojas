'use client'

import { useEffect, useState } from 'react'
import { api } from '../../../../lib/api'

interface OrderItem {
  id: string
  name: string
  quantity: number
  price: string | number
}

interface Order {
  id: string
  status: string
  total: string | number
  subtotal: string | number
  discount: string | number
  shipping: string | number
  couponCode?: string | null
  createdAt: string
  customer?: { name: string; email: string; phone?: string } | null
  items: OrderItem[]
  payment?: { method: string; status: string; installments: number } | null
}

type OrderStatus =
  | 'PENDING' | 'AWAITING_PAYMENT' | 'PAID' | 'PROCESSING'
  | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  AWAITING_PAYMENT: 'Aguard. pagamento',
  PAID: 'Pago',
  PROCESSING: 'Em processamento',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  CANCELLED: 'Cancelado',
  REFUNDED: 'Estornado',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  AWAITING_PAYMENT: 'bg-orange-100 text-orange-700',
  PAID: 'bg-green-100 text-green-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-gray-100 text-gray-500',
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  PIX: 'PIX',
  BOLETO: 'Boleto',
  CASH: 'Dinheiro',
}

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'AWAITING_PAYMENT', label: 'Aguard. pag.' },
  { value: 'PAID', label: 'Pago' },
  { value: 'PROCESSING', label: 'Processando' },
  { value: 'SHIPPED', label: 'Enviado' },
  { value: 'DELIVERED', label: 'Entregue' },
  { value: 'CANCELLED', label: 'Cancelado' },
]

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING: ['AWAITING_PAYMENT', 'CANCELLED'],
  AWAITING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
}

const brl = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<Order | null>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { window.location.href = '/admin/login'; return }
    load()
  }, [filter, page])

  function load() {
    const token = localStorage.getItem('admin_token') ?? ''
    setLoading(true)
    const params = new URLSearchParams({ page: String(page) })
    if (filter !== 'all') params.set('status', filter)
    api.get<any>(`/orders?${params}`, { token })
      .then((res) => {
        if (Array.isArray(res)) {
          setOrders(res)
        } else {
          setOrders(res.data ?? [])
          setTotalPages(res.totalPages ?? 1)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  async function updateStatus(orderId: string, status: string) {
    const token = localStorage.getItem('admin_token') ?? ''
    setUpdatingStatus(true)
    try {
      await api.put(`/orders/${orderId}/status`, { status }, { token })
      load()
      if (selected?.id === orderId) {
        setSelected((prev) => prev ? { ...prev, status } : null)
      }
    } catch (e: any) {
      alert(e.message)
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Pedidos</h1>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f.value} onClick={() => { setFilter(f.value); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
              ${filter === f.value ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className={`grid gap-6 ${selected ? 'grid-cols-5' : 'grid-cols-1'}`}>
        {/* Lista */}
        <div className={selected ? 'col-span-3' : 'col-span-1'}>
          <div className="bg-white rounded-xl border">
            {loading ? (
              <p className="p-6 text-gray-400 text-sm">Carregando pedidos...</p>
            ) : orders.length === 0 ? (
              <p className="p-6 text-gray-400 text-sm">Nenhum pedido encontrado.</p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Pedido', 'Cliente', 'Total', 'Status', 'Data'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}
                        onClick={() => setSelected(selected?.id === order.id ? null : order)}
                        className={`border-t cursor-pointer transition
                          ${selected?.id === order.id ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                        <td className="px-4 py-3 font-mono text-xs font-medium">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-4 py-3">
                          <div>{order.customer?.name || '—'}</div>
                          <div className="text-xs text-gray-400">{order.customer?.email || ''}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold">{brl(order.total)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                            {STATUS_LABEL[order.status] ?? order.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 p-4 border-t">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">
                      ← Anterior
                    </button>
                    <span className="px-3 py-1 text-sm text-gray-500">{page} / {totalPages}</span>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-50">
                      Próxima →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Detalhe */}
        {selected && (
          <div className="col-span-2">
            <div className="bg-white rounded-xl border sticky top-6">
              <div className="p-4 border-b flex items-center justify-between">
                <span className="font-semibold text-sm">#{selected.id.slice(0, 8).toUpperCase()}</span>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
              </div>

              <div className="p-4 space-y-4">
                {/* Status atual + ações */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Status atual</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[selected.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                  {NEXT_STATUS[selected.status as OrderStatus] && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {NEXT_STATUS[selected.status as OrderStatus]!.map((s) => (
                        <button key={s} onClick={() => updateStatus(selected.id, s)} disabled={updatingStatus}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition disabled:opacity-50
                            ${s === 'CANCELLED' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-black text-black hover:bg-black hover:text-white'}`}>
                          {updatingStatus ? '...' : `→ ${STATUS_LABEL[s]}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cliente */}
                {selected.customer && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Cliente</p>
                    <p className="text-sm font-medium">{selected.customer.name}</p>
                    <p className="text-xs text-gray-500">{selected.customer.email}</p>
                    {selected.customer.phone && <p className="text-xs text-gray-500">{selected.customer.phone}</p>}
                  </div>
                )}

                {/* Pagamento */}
                {selected.payment && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Pagamento</p>
                    <p className="text-sm">{PAYMENT_METHOD_LABEL[selected.payment.method] ?? selected.payment.method}
                      {selected.payment.installments > 1 && ` — ${selected.payment.installments}x`}
                    </p>
                    <span className={`text-xs ${selected.payment.status === 'APPROVED' ? 'text-green-600' : 'text-gray-500'}`}>
                      {selected.payment.status}
                    </span>
                  </div>
                )}

                {/* Itens */}
                <div>
                  <p className="text-xs text-gray-400 mb-2">Itens do pedido</p>
                  <div className="space-y-1">
                    {selected.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-700">{item.quantity}× {item.name}</span>
                        <span className="font-medium">{brl(Number(item.price) * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totais */}
                <div className="border-t pt-3 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Subtotal</span><span>{brl(selected.subtotal)}</span>
                  </div>
                  {Number(selected.discount) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Desconto {selected.couponCode && `(${selected.couponCode})`}</span>
                      <span>−{brl(selected.discount)}</span>
                    </div>
                  )}
                  {Number(selected.shipping) > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span>Frete</span><span>{brl(selected.shipping)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base pt-1 border-t">
                    <span>Total</span><span>{brl(selected.total)}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-400">
                  {new Date(selected.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
