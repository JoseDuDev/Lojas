'use client'

import { useEffect, useState } from 'react'
import { api } from '../../../../lib/api'

interface Coupon {
  id: string
  code: string
  type: 'PERCENTAGE' | 'FIXED'
  value: string | number
  minValue?: string | number | null
  maxUses?: number | null
  usedCount: number
  active: boolean
  expiresAt?: string | null
  createdAt: string
}

interface CouponForm {
  code: string
  type: 'PERCENTAGE' | 'FIXED'
  value: string
  minValue: string
  maxUses: string
  expiresAt: string
  active: boolean
}

const EMPTY_FORM: CouponForm = {
  code: '', type: 'PERCENTAGE', value: '', minValue: '', maxUses: '', expiresAt: '', active: true,
}

const brl = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function formatDiscount(type: string, value: string | number) {
  return type === 'PERCENTAGE' ? `${Number(value)}%` : brl(value)
}

function formatExpiry(expiresAt?: string | null) {
  if (!expiresAt) return '—'
  const d = new Date(expiresAt)
  const now = new Date()
  const expired = d < now
  const label = d.toLocaleDateString('pt-BR')
  return expired ? `${label} (expirado)` : label
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<CouponForm>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { window.location.href = '/admin/login'; return }
    load(token)
  }, [])

  function load(token?: string) {
    const t = token ?? localStorage.getItem('admin_token') ?? ''
    setLoading(true)
    api.get<any>('/coupons', { token: t })
      .then((res) => setCoupons(Array.isArray(res) ? res : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setError('')
    setShowForm(true)
  }

  function openEdit(c: Coupon) {
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      minValue: c.minValue != null ? String(c.minValue) : '',
      maxUses: c.maxUses != null ? String(c.maxUses) : '',
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
      active: c.active,
    })
    setEditId(c.id)
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.code || !form.value) { setError('Código e valor são obrigatórios.'); return }
    const token = localStorage.getItem('admin_token') ?? ''
    setSaving(true)
    setError('')
    const body = {
      code: form.code.toUpperCase(),
      type: form.type,
      value: Number(form.value),
      minValue: form.minValue ? Number(form.minValue) : undefined,
      maxUses: form.maxUses ? Number(form.maxUses) : undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      active: form.active,
    }
    try {
      if (editId) {
        await api.put(`/coupons/${editId}`, body, { token })
      } else {
        await api.post('/coupons', body, { token })
      }
      setShowForm(false)
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string, code: string) {
    if (!confirm(`Excluir cupom "${code}"?`)) return
    const token = localStorage.getItem('admin_token') ?? ''
    try {
      await api.delete(`/coupons/${id}`, { token })
      load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function toggleActive(c: Coupon) {
    const token = localStorage.getItem('admin_token') ?? ''
    try {
      await api.put(`/coupons/${c.id}`, { active: !c.active }, { token })
      load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const isExpired = (c: Coupon) => !!c.expiresAt && new Date(c.expiresAt) < new Date()
  const isExhausted = (c: Coupon) => c.maxUses !== null && c.maxUses !== undefined && c.usedCount >= c.maxUses

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Cupons de desconto</h1>
        <button onClick={openCreate}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition">
          + Novo cupom
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">{editId ? 'Editar cupom' : 'Novo cupom'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Código *</label>
              <input
                className="border rounded-lg px-3 py-2 w-full text-sm uppercase tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="PROMO10"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tipo *</label>
              <select
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as 'PERCENTAGE' | 'FIXED' })}
              >
                <option value="PERCENTAGE">Percentual (%)</option>
                <option value="FIXED">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">
                {form.type === 'PERCENTAGE' ? 'Desconto (%)  *' : 'Desconto (R$) *'}
              </label>
              <input
                type="number" min="0" step={form.type === 'PERCENTAGE' ? '1' : '0.01'}
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder={form.type === 'PERCENTAGE' ? 'Ex: 10' : 'Ex: 25.00'}
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Pedido mínimo (R$)</label>
              <input
                type="number" min="0" step="0.01"
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Sem mínimo"
                value={form.minValue}
                onChange={(e) => setForm({ ...form, minValue: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Limite de usos</label>
              <input
                type="number" min="1"
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Ilimitado"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Válido até</label>
              <input
                type="date"
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none mt-4">
                <input type="checkbox" className="w-4 h-4"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Ativo
              </label>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          <div className="flex gap-3 mt-5">
            <button onClick={save} disabled={saving}
              className="bg-black text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-800">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-5 py-2 rounded-lg text-sm border hover:bg-gray-50">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b font-semibold text-sm">
          {loading ? 'Carregando...' : `${coupons.length} cupom${coupons.length !== 1 ? 'ns' : ''}`}
        </div>
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Carregando cupons...</p>
        ) : coupons.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Nenhum cupom cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Código', 'Desconto', 'Pedido mín.', 'Usos', 'Validade', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const expired = isExpired(c)
                const exhausted = isExhausted(c)
                return (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-semibold tracking-wider">{c.code}</td>
                    <td className="px-4 py-3">
                      <span className={`font-semibold ${c.type === 'PERCENTAGE' ? 'text-blue-700' : 'text-green-700'}`}>
                        {formatDiscount(c.type, c.value)}
                      </span>
                      <span className="ml-1 text-xs text-gray-400">{c.type === 'PERCENTAGE' ? 'desc.' : 'fixo'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {c.minValue ? brl(c.minValue) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={exhausted ? 'text-red-500 font-medium' : 'text-gray-700'}>
                        {c.usedCount}
                        {c.maxUses != null ? `/${c.maxUses}` : ' (∞)'}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-xs ${expired ? 'text-red-500' : 'text-gray-500'}`}>
                      {formatExpiry(c.expiresAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(c)}
                        className={`px-2 py-1 rounded-full text-xs font-medium transition
                          ${c.active && !expired && !exhausted
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {c.active && !expired && !exhausted ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline text-xs mr-3">Editar</button>
                      <button onClick={() => remove(c.id, c.code)} className="text-red-500 hover:underline text-xs">Excluir</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
