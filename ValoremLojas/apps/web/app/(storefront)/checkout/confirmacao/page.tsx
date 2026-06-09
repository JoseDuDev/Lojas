'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '../../../../lib/api'

type PageState = 'loading' | 'approved' | 'processing' | 'failed' | 'timeout' | 'not_found'

interface OrderStatus {
  id: string
  status: string
  total: string | number
  createdAt: string
  customer?: { name: string } | null
  payment?: { status: string; method: string } | null
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  PIX: 'PIX',
  BOLETO: 'Boleto',
  CASH: 'Dinheiro',
}

const FINAL_ORDER_STATUSES = new Set(['PAID', 'DELIVERED', 'CANCELLED', 'REFUNDED'])
const FAILED_ORDER_STATUSES = new Set(['CANCELLED', 'REFUNDED'])
const APPROVED_ORDER_STATUSES = new Set(['PAID', 'DELIVERED'])

const MAX_POLLS = 12       // ~36 segundos
const POLL_INTERVAL = 3000 // 3s

function resolveState(status: string): PageState {
  if (APPROVED_ORDER_STATUSES.has(status)) return 'approved'
  if (FAILED_ORDER_STATUSES.has(status)) return 'failed'
  return 'processing'
}

const brl = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function CheckoutConfirmacaoPage() {
  const params = useSearchParams()
  const [state, setState] = useState<PageState>('loading')
  const [order, setOrder] = useState<OrderStatus | null>(null)
  const pollCount = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Obtém o orderId: primeiro da URL (?id_externo=), depois do localStorage
  const orderId = params.get('id_externo') || params.get('idExterno')
    || (typeof window !== 'undefined' ? localStorage.getItem('pending_order_id') : null)

  useEffect(() => {
    if (!orderId) {
      setState('not_found')
      return
    }
    poll()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [orderId])

  async function poll() {
    if (!orderId) return
    try {
      const data = await api.get<OrderStatus>(`/orders/${orderId}/status`)
      setOrder(data)

      if (FINAL_ORDER_STATUSES.has(data.status)) {
        setState(resolveState(data.status))
        localStorage.removeItem('pending_order_id')
        return
      }

      pollCount.current += 1
      if (pollCount.current >= MAX_POLLS) {
        setState('timeout')
        return
      }

      timerRef.current = setTimeout(poll, POLL_INTERVAL)
    } catch {
      setState('not_found')
    }
  }

  // ── Loading ───────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="w-14 h-14 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto mb-6" />
        <h1 className="text-xl font-bold mb-2">Verificando pagamento...</h1>
        <p className="text-gray-400 text-sm">Aguarde, estamos confirmando seu pedido.</p>
      </div>
    )
  }

  // ── Aprovado ──────────────────────────────────────────────
  if (state === 'approved') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Pagamento aprovado!</h1>
        {order && (
          <div className="mt-4 bg-gray-50 rounded-xl p-5 text-left text-sm space-y-2 mb-6">
            <div className="flex justify-between">
              <span className="text-gray-500">Pedido</span>
              <span className="font-mono font-semibold">#{order.id.slice(0, 8).toUpperCase()}</span>
            </div>
            {order.customer?.name && (
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente</span>
                <span>{order.customer.name}</span>
              </div>
            )}
            {order.payment?.method && (
              <div className="flex justify-between">
                <span className="text-gray-500">Pagamento</span>
                <span>{PAYMENT_METHOD_LABEL[order.payment.method] ?? order.payment.method}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t pt-2 mt-2">
              <span>Total</span>
              <span className="text-green-700">{brl(order.total)}</span>
            </div>
          </div>
        )}
        <p className="text-sm text-gray-500 mb-8">
          Você receberá um e-mail de confirmação em breve com os detalhes do pedido.
        </p>
        <Link href="/"
          className="inline-block py-3 px-8 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition">
          Continuar comprando
        </Link>
      </div>
    )
  }

  // ── Falhou ────────────────────────────────────────────────
  if (state === 'failed') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Pagamento não aprovado</h1>
        {order && (
          <p className="text-sm text-gray-400 mb-2">
            Pedido <code className="font-mono bg-gray-100 px-2 py-0.5 rounded">
              #{order.id.slice(0, 8).toUpperCase()}
            </code>
          </p>
        )}
        <p className="text-gray-500 text-sm mt-3 mb-8">
          O pagamento foi recusado ou cancelado. Você pode tentar novamente com outro método.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/checkout"
            className="py-3 px-6 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition text-sm">
            Tentar novamente
          </Link>
          <Link href="/"
            className="py-3 px-6 rounded-xl border font-semibold hover:bg-gray-50 transition text-sm">
            Voltar à loja
          </Link>
        </div>
      </div>
    )
  }

  // ── Timeout (ainda processando após N tentativas) ─────────
  if (state === 'timeout') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Pedido recebido</h1>
        {order && (
          <p className="text-sm text-gray-400 mb-2">
            Pedido <code className="font-mono bg-gray-100 px-2 py-0.5 rounded">
              #{order.id.slice(0, 8).toUpperCase()}
            </code>
          </p>
        )}
        <p className="text-gray-500 text-sm mt-3 mb-2">
          Seu pedido está sendo processado pela operadora de pagamento.
        </p>
        <p className="text-gray-400 text-sm mb-8">
          Você receberá um e-mail assim que o pagamento for confirmado.
        </p>
        <Link href="/"
          className="inline-block py-3 px-8 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition">
          Voltar à loja
        </Link>
      </div>
    )
  }

  // ── Processando (status intermediário) ───────────────────
  if (state === 'processing') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Pedido recebido!</h1>
        {order && (
          <p className="text-sm text-gray-400 mb-2">
            Pedido <code className="font-mono bg-gray-100 px-2 py-0.5 rounded">
              #{order.id.slice(0, 8).toUpperCase()}
            </code>
          </p>
        )}
        <p className="text-gray-500 text-sm mt-3 mb-8">
          Aguardando confirmação do pagamento. Você receberá um e-mail quando aprovado.
        </p>
        <Link href="/"
          className="inline-block py-3 px-8 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition">
          Voltar à loja
        </Link>
      </div>
    )
  }

  // ── Não encontrado ────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <p className="text-5xl mb-4">🔍</p>
      <h1 className="text-xl font-bold mb-2">Pedido não encontrado</h1>
      <p className="text-gray-400 text-sm mb-8">
        Não conseguimos localizar este pedido. Se você acabou de comprar, verifique seu e-mail.
      </p>
      <Link href="/"
        className="inline-block py-3 px-8 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition">
        Voltar à loja
      </Link>
    </div>
  )
}
