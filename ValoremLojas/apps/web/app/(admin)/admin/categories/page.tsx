'use client'

import { useEffect, useState } from 'react'
import { api } from '../../../../lib/api'

interface Category {
  id: string
  name: string
  slug: string
  parentId?: string | null
  imageUrl?: string | null
  active: boolean
  _count?: { products: number }
  children?: Category[]
}

interface CategoryForm {
  name: string
  slug: string
  parentId: string
  imageUrl: string
  active: boolean
}

const EMPTY_FORM: CategoryForm = {
  name: '', slug: '', parentId: '', imageUrl: '', active: true,
}

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [flat, setFlat] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryForm>({ ...EMPTY_FORM })
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
    Promise.all([
      api.get<any>('/categories?all=true', { token: t }),
      api.get<any>('/categories?flat=true', { token: t }),
    ])
      .then(([tree, flatList]) => {
        setCategories(Array.isArray(tree) ? tree : [])
        setFlat(Array.isArray(flatList) ? flatList : [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM })
    setEditId(null)
    setError('')
    setShowForm(true)
  }

  function openEdit(cat: Category) {
    setForm({
      name: cat.name,
      slug: cat.slug,
      parentId: cat.parentId ?? '',
      imageUrl: cat.imageUrl ?? '',
      active: cat.active,
    })
    setEditId(cat.id)
    setError('')
    setShowForm(true)
  }

  async function save() {
    if (!form.name || !form.slug) { setError('Nome e slug são obrigatórios.'); return }
    const token = localStorage.getItem('admin_token') ?? ''
    setSaving(true)
    setError('')
    const body = {
      name: form.name,
      slug: form.slug,
      parentId: form.parentId || undefined,
      imageUrl: form.imageUrl || undefined,
      active: form.active,
    }
    try {
      if (editId) {
        await api.put(`/categories/${editId}`, body, { token })
      } else {
        await api.post('/categories', body, { token })
      }
      setShowForm(false)
      load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Excluir "${name}"? Os produtos associados perderão a categoria.`)) return
    const token = localStorage.getItem('admin_token') ?? ''
    try {
      await api.delete(`/categories/${id}`, { token })
      load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  async function toggleActive(cat: Category) {
    const token = localStorage.getItem('admin_token') ?? ''
    try {
      await api.put(`/categories/${cat.id}`, { active: !cat.active }, { token })
      load()
    } catch (e: any) {
      alert(e.message)
    }
  }

  // Renderiza categorias em árvore (raiz + filhas)
  const rows: { cat: Category; depth: number }[] = []
  for (const cat of categories) {
    rows.push({ cat, depth: 0 })
    if (cat.children?.length) {
      for (const child of cat.children) {
        rows.push({ cat: child, depth: 1 })
      }
    }
  }

  // Lista de categorias raiz disponíveis para ser "pai" (exclui a própria ao editar)
  const parentOptions = flat.filter((c) => !c.parentId && c.id !== editId)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Categorias</h1>
        <button onClick={openCreate}
          className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition">
          + Nova categoria
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="bg-white border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">{editId ? 'Editar categoria' : 'Nova categoria'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Nome *</label>
              <input
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="Ex: Camisetas"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Slug *</label>
              <input
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="camisetas"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Categoria pai (opcional)</label>
              <select
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
                value={form.parentId}
                onChange={(e) => setForm({ ...form, parentId: e.target.value })}
              >
                <option value="">— Nenhuma (categoria raiz)</option>
                {parentOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">URL da imagem (opcional)</label>
              <input
                className="border rounded-lg px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-black"
                placeholder="https://cdn.seusite.com.br/cat.jpg"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none mt-4">
                <input type="checkbox" className="w-4 h-4"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Ativa
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
          {loading ? 'Carregando...' : `${flat.length} categoria${flat.length !== 1 ? 's' : ''}`}
        </div>
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Carregando categorias...</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Nenhuma categoria cadastrada ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Categoria', 'Slug', 'Produtos', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cat, depth }) => (
                <tr key={cat.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {depth > 0 && <span className="text-gray-300 text-base">└</span>}
                      <span className={depth > 0 ? 'text-gray-600' : 'font-medium'}>{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{cat.slug}</td>
                  <td className="px-4 py-3 text-gray-500">{cat._count?.products ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(cat)}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition
                        ${cat.active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {cat.active ? 'Ativa' : 'Inativa'}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button onClick={() => openEdit(cat)} className="text-blue-600 hover:underline text-xs mr-3">Editar</button>
                    <button onClick={() => remove(cat.id, cat.name)} className="text-red-500 hover:underline text-xs">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
