import { Injectable, Logger, BadRequestException } from '@nestjs/common'

// ============================================================
// STATUS CODES da Valorem Pay (via webhook e resposta direta)
// ============================================================
export enum ValoremStatus {
  CONFIRMADO        = 1,
  LIQUIDADO         = 3,
  CANCELADO         = 4,
  EM_PROGRESSO      = 5,
  NEGADO            = 6,
  EXPIRADO          = 7,
  ERRO_CONFIRMACAO  = 8,
  FALHA             = 9,
  REEMBOLSADO       = 10,
  ERRO_REEMBOLSO    = 13,
  EXPIRACAO_REMBOLSO= 14,
  ERRO_AUTORIZACAO  = 17,
}

// ============================================================
// DTOs internos — usados pelo PaymentsService
// ============================================================

/** Dados do cartão físico (checkout transparente) */
export interface ValoremCardData {
  valor: number
  numeroDoCartao: string
  codigoSeguranca: string
  mesVencimento: number
  anoVencimento: number
  nomeTitular: string
  cpfCnpj: string
  telefone: string
  email: string
  // Endereço de cobrança
  cep: string
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  uf: string
  complemento?: string
}

/** Cartão tokenizado (recompra sem redigitar dados) */
export interface ValoremTokenizedCard {
  valor: number
  token: string
  codigoSeguranca: string
  nomeTitular: string
  cpfCnpj: string
  telefone: string
  email: string
  cep: string
  logradouro: string
  numero: string
  bairro: string
  cidade: string
  uf: string
  complemento?: string
}

export interface CreateTransparentPaymentDto {
  orderId: string            // vira idExterno
  amount: number
  installments?: number
  tributo?: string           // campo exigido pela API — configure conforme contrato Valorem
  saveCard?: boolean         // retornarToken: true → recebe token para reutilização
  card?: ValoremCardData     // cartão físico
  tokenizedCard?: ValoremTokenizedCard  // ou cartão tokenizado
}

export interface CreateWhiteLabelPaymentDto {
  orderId: string
  amount: number
  installments?: number
  tributo?: string
  redirectUrl: string        // urlRedirecionamento após conclusão no checkout Valorem
  buyer: {
    name: string
    cpfCnpj: string
    phone?: string
    zipCode?: string
    street?: string
    number?: string
    district?: string
    city?: string
    state?: string
    complement?: string
  }
}

/** Resultado padronizado devolvido ao PaymentsService */
export interface PaymentResult {
  idRequisicao: string       // id_requisicao da Valorem — referência da transação
  status: 'pending' | 'approved' | 'failed'
  statusCode: number         // código numérico original da Valorem
  message?: string
  checkoutUrl?: string       // white-label: URL para redirecionar o cliente
  cardToken?: string         // token do cartão se retornarToken=true
}

/** Payload recebido via webhook da Valorem */
export interface ValoremWebhookRegistro {
  id_externo: string         // nosso orderId
  valor: number
  valor_original: number
  id_requisicao: string      // ID da transação na Valorem
  pagamento_id: string | null
  status: number             // ValoremStatus
  nsus: string[]
  data_credito: string
  quantidade_cartoes: number
  tipo_pagamento: number
  quantidade_parcelas: number | null
  valor_parcela: number | null
  parcela: string
  mensagem?: string
  data_cancelamento?: string
}

export interface ValoremWebhookPayload {
  registros: ValoremWebhookRegistro[]
}

// ============================================================
// PROVIDER
// ============================================================

@Injectable()
export class ValoremPaymentProvider {
  private readonly logger = new Logger(ValoremPaymentProvider.name)

  private get baseUrl(): string {
    return (process.env.PAYMENT_API_URL || 'https://external-api-homolog.checkout.valorem.com.br').replace(/\/$/, '')
  }

  private get apiKey(): string {
    return process.env.PAYMENT_API_KEY || ''
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    }
  }

  // ----------------------------------------------------------
  // 1. Pagamento Transparente — POST /api/v1/Pagamento
  //    Checkout próprio com dados completos do cartão
  // ----------------------------------------------------------
  async createTransparentPayment(data: CreateTransparentPaymentDto): Promise<PaymentResult> {
    this.logger.log(`[Transparente] Iniciando pagamento para pedido ${data.orderId}`)

    if (!data.card && !data.tokenizedCard) {
      throw new BadRequestException('Informe os dados do cartão ou o token do cartão')
    }

    const body: Record<string, any> = {
      tributo: data.tributo || '',
      valor: data.amount,
      numeroDeParcelas: data.installments || 1,
      idExterno: data.orderId,
      qtdeCartoes: 'Um',
      retornarToken: data.saveCard ?? false,
    }

    if (data.card) {
      body.cartoes = [data.card]
    } else if (data.tokenizedCard) {
      body.cartoesTokenizados = [data.tokenizedCard]
    }

    const response = await fetch(`${this.baseUrl}/api/v1/Pagamento`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    })

    const raw = await response.text()
    this.logger.debug(`[Transparente] Resposta: ${raw}`)

    if (!response.ok) {
      this.logger.error(`[Transparente] Erro HTTP ${response.status}: ${raw}`)
      throw new BadRequestException(`Falha na plataforma Valorem: ${response.status}`)
    }

    const result = JSON.parse(raw)

    // A API retorna o registro diretamente ou dentro de { registros: [...] }
    const registro: ValoremWebhookRegistro | undefined =
      result?.registros?.[0] ?? result

    const statusCode: number = registro?.status ?? 0
    const idRequisicao: string = registro?.id_requisicao ?? ''

    return {
      idRequisicao,
      status: this.mapStatus(statusCode),
      statusCode,
      message: registro?.mensagem,
      cardToken: result?.token ?? result?.cardToken ?? undefined,
    }
  }

  // ----------------------------------------------------------
  // 2. Pagamento White-Label — POST /api/v1/Pagamento/gerar-link-white-label
  //    Gera link para o checkout hospedado pela Valorem
  // ----------------------------------------------------------
  async createWhiteLabelPayment(data: CreateWhiteLabelPaymentDto): Promise<PaymentResult> {
    this.logger.log(`[WhiteLabel] Gerando link para pedido ${data.orderId}`)

    const body = {
      tributo: data.tributo || '',
      tef: false,
      valor: data.amount,
      numeroDeParcelas: data.installments || 1,
      urlRedirecionamento: data.redirectUrl,
      idExterno: data.orderId,
      comprador: {
        nomeComprador: data.buyer.name,
        cpfcnpjComprador: data.buyer.cpfCnpj,
        telefone: data.buyer.phone || '',
        cep: data.buyer.zipCode || '',
        logradouro: data.buyer.street || '',
        numero: data.buyer.number || '',
        bairro: data.buyer.district || '',
        cidade: data.buyer.city || '',
        uf: data.buyer.state || '',
        complemento: data.buyer.complement || '',
      },
    }

    const response = await fetch(`${this.baseUrl}/api/v1/Pagamento/gerar-link-white-label`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    })

    const raw = await response.text()
    this.logger.debug(`[WhiteLabel] Resposta: ${raw}`)

    if (!response.ok) {
      this.logger.error(`[WhiteLabel] Erro HTTP ${response.status}: ${raw}`)
      throw new BadRequestException(`Falha ao gerar link Valorem: ${response.status}`)
    }

    const result = JSON.parse(raw)

    // A resposta do white-label retorna a URL do checkout
    const checkoutUrl: string =
      result?.linkPagamento ?? result?.link ?? result?.url ?? result?.checkoutUrl ?? ''

    return {
      idRequisicao: result?.id_requisicao ?? result?.idRequisicao ?? data.orderId,
      status: 'pending',    // o pagamento ainda não foi realizado — aguarda o cliente
      statusCode: ValoremStatus.EM_PROGRESSO,
      message: 'Aguardando pagamento no checkout Valorem',
      checkoutUrl,
    }
  }

  // ----------------------------------------------------------
  // 3. Cancelamento / Estorno — POST /api/v1/Pagamento/Cancelamento
  //    Mesmo dia: estorno total. Dias posteriores: cancelamento parcial possível.
  // ----------------------------------------------------------
  async cancelPayment(idPagamento: string, partialAmount?: number): Promise<void> {
    this.logger.log(`[Cancelamento] idPagamento=${idPagamento} valor=${partialAmount ?? 'total'}`)

    const body: Record<string, any> = { IdPagamento: idPagamento }
    if (partialAmount !== undefined) {
      body.valor = partialAmount
    }

    const response = await fetch(`${this.baseUrl}/api/v1/Pagamento/Cancelamento`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      this.logger.error(`[Cancelamento] Erro: ${error}`)
      throw new BadRequestException(`Falha ao cancelar: ${response.status}`)
    }

    this.logger.log(`[Cancelamento] Solicitação enviada com sucesso`)
  }

  // ----------------------------------------------------------
  // 4. Consulta de transações — GET /api/v1/Pagamento/historico-transacoes
  // ----------------------------------------------------------
  async getTransactionHistory(params: {
    dataInicio: string   // ex: '2024-09-18 00:00:00'
    dataTermino: string
    page?: number
    pageSize?: number
  }) {
    const qs = new URLSearchParams({
      DataInicio: params.dataInicio,
      DataTermino: params.dataTermino,
      TamanhoDaPagina: String(params.pageSize ?? 100),
      NumeroDaPagina: String(params.page ?? 0),
    })

    const response = await fetch(
      `${this.baseUrl}/api/v1/Pagamento/historico-transacoes?${qs}`,
      { headers: this.headers() },
    )

    if (!response.ok) throw new BadRequestException('Erro ao consultar histórico')
    return response.json()
  }

  // ----------------------------------------------------------
  // 5. Tokenizar cartão — POST /api/v1/Pagamento/tokenizar
  //    Retorna token para reuso sem redigitar dados
  // ----------------------------------------------------------
  async tokenizeCard(params: {
    cnpjEstabelecimento: string
    identificadorCliente: string   // CPF ou CNPJ do cliente
    card: {
      numeroDoCartao: string
      mesVencimento: string
      anoVencimento: string
    }
  }): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/v1/Pagamento/tokenizar`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(params),
    })

    if (!response.ok) throw new BadRequestException('Falha ao tokenizar cartão')

    const result = await response.json()
    return result.token ?? result
  }

  // ----------------------------------------------------------
  // Utilitário: mapeia status numérico Valorem → status interno
  // ----------------------------------------------------------
  mapStatus(statusCode: number): 'pending' | 'approved' | 'failed' {
    switch (statusCode) {
      case ValoremStatus.CONFIRMADO:
      case ValoremStatus.LIQUIDADO:
        return 'approved'
      case ValoremStatus.EM_PROGRESSO:
        return 'pending'
      case ValoremStatus.NEGADO:
      case ValoremStatus.EXPIRADO:
      case ValoremStatus.ERRO_CONFIRMACAO:
      case ValoremStatus.FALHA:
      case ValoremStatus.ERRO_AUTORIZACAO:
        return 'failed'
      default:
        return 'pending'
    }
  }
}
