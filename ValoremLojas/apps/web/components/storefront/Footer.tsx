interface Props {
  store: { name?: string } | null
}

export default function StorefrontFooter({ store }: Props) {
  return (
    <footer className="border-t mt-16 py-8 text-center text-sm text-gray-400">
      <p>© {new Date().getFullYear()} {store?.name || 'Loja Virtual'}. Todos os direitos reservados.</p>
      <p className="mt-1">
        Powered by{' '}
        <span className="font-semibold text-gray-600">Valorem Lojas</span>
      </p>
    </footer>
  )
}
