import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Admin — Valorem Lojas',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-50">{children}</body>
    </html>
  )
}
