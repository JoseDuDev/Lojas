'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../../../../lib/api'

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { email, password })
      localStorage.setItem('admin_token', res.accessToken)
      router.push('/admin')
    } catch (err: any) {
      setError(err.message || 'Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">Valorem Lojas</h1>
          <p className="text-gray-500 text-sm mt-1">Acesso ao painel administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border rounded-2xl p-8 space-y-4 shadow-sm">
          <div>
            <label className="block text-sm font-medium mb-1">E-mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              required className="w-full border rounded-lg px-4 py-2.5 text-sm" placeholder="admin@loja.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Senha</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              required className="w-full border rounded-lg px-4 py-2.5 text-sm" placeholder="••••••" />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 disabled:bg-gray-400 transition">
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
