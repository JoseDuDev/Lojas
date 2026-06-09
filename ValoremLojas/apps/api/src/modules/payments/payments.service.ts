import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { PrismaService } from '../../infra/database/prisma.service'
import {
  ValoremPaymentProvider,
  ValoremStatus,
  ValoremWebhookPayload,
  CreateTransparentPaymentDto,
  CreateWhiteLabelPaymentDto,
} from './providers/valorem.provider'
import { NotificationsService } from '../notifications/notifications.service'

// -------------------------------------------------------
// DTO recebido pelo CheckoutService / Controller
// -------------------------------------------------------
export interface ProcessPaymentDto {
  method: 'CREDIT_CARD' | 'WHITE_LABEL'
  installments?: number
  saveCard?: boolean

  // Dados do cartão — obrigatório para CREDIT_CARD
  card?: {
    numeroDoCartao: string
    codigoSeguranca: string
    mesVencimento: number
    anoVencimento: number
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

  // Token de cartão salvo — alternativa ao card
  tokenizedCard?: {
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
  }

  // White-label: URL de retorno após o pagamento no checkout Valorem
  redirectUrl?: string
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly valoremProvider: ValoremPaymentProvider,
    private readonly notifications: NotificationsService,
  ) {}

  // -------------------------------------------------------
  // Processa pagamento — chamado pelo CheckoutService
  // -------------------------------------------------------
  async processPayment(orderId: string, data: ProcessPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true },
    })

    if (!order) throw new BadRequestException('Pedido não encontrado')
    if (order.status !== 'PENDING' && order.status !== 'AWAITING_PAYMENT') {
      throw new BadRequestException('Pedido não pode ser pago com status atual')
    }

    let result: Awaited<ReturnType<ValoremPaymentProvider['createTransparentPayment']>>

    // ----- Checkout Transparente (cartão de crédito) -----
    if (data.method === 'CREDIT_CARD') {
      if (!data.card && !data.tokenizedCard) {
        throw new BadRequestException('Dados do cartão são obrigatórios para pagamento transparente')
      }

      const dto: CreateTransparentPaymentDto = {
        orderId,
        amount: Number(order.total),
        installments: data.installments || 1,
        saveCard: data.saveCard,
        tributo: process.env.PAYMENT_TRIBUTO || '',
      }

      if (data.card) {
        dto.card = { ...data.card, valor: Number(order.total) }
      } else if (data.tokenizedCard) {
        dto.tokenizedCard = { ...data.tokenizedCard, valor: Number(order.total) }
      }

      result = await this.valoremProvider.createTransparentPayment(dto)
    }

    // ----- Checkout White-Label (hospedado na Valorem) -----
    else if (data.method === 'WHITE_LABEL') {
      const wlDto: CreateWhiteLabelPaymentDto = {
        orderId,
        amount: Number(order.total),
        installments: data.installments || 1,
        tributo: process.env.PAYMENT_TRIBUTO || '',
        redirectUrl: data.redirectUrl || process.env.FRONTEND_URL + '/checkout/confirmacao',
        buyer: {
          name: order.customer?.name || '',
          cpfCnpj: order.customer?.cpf || '',
          phone: order.customer?.phone || '',
          zipCode: order.shippingZipCode || '',
          street: order.shippingStreet || '',
          number: order.shippingNumber || '',
          city: order.shippingCity || '',
          state: order.shippingState || '',
        },
      }

      result = await this.valoremProvider.createWhiteLabelPayment(wlDto)
    } else {
      throw new BadRequestException(`Método de pagamento inválido: ${data.method}`)
    }

    // ----- Persiste o pagamento -----
    const dbStatus = result.status === 'approved' ? 'APPROVED'
      : result.status === 'failed' ? 'FAILED'
      : 'PROCESSING'

    const payment = await this.prisma.payment.create({
      data: {
        orderId,
        provider: 'valorem',
        method: data.method === 'WHITE_LABEL' ? 'CREDIT_CARD' : 'CREDIT_CARD',
        status: dbStatus,
        amount: order.total,
        installments: data.installments || 1,
        externalId: result.idRequisicao,
        paidAt: result.status === 'approved' ? new Date() : null,
      },
    })

    // ----- Atualiza pedido -----
    const orderStatus =
      result.status === 'approved' ? 'PAID'
      : result.status === 'failed' ? 'CANCELLED'
      : 'AWAITING_PAYMENT'

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: orderStatus },
    })

    return {
      payment,
      status: result.status,
      statusCode: result.statusCode,
      message: result.message,
      checkoutUrl: result.checkoutUrl,      // white-label: redirecionar para cá
      cardToken: result.cardToken,          // token salvo para recompra
    }
  }

  // -------------------------------------------------------
  // Webhook da Valorem — POST /payments/webhook
  // Valorem envia { registros: [...] } com status numérico
  // Resposta esperada pela Valorem: { ok: bool, msg: null }
  // -------------------------------------------------------
  async handleWebhook(payload: ValoremWebhookPayload) {
    const registros = payload?.registros ?? []

    for (const registro of registros) {
      const { id_externo, id_requisicao, status: statusCode, mensagem } = registro

      this.logger.log(
        `[Webhook] id_externo=${id_externo} id_requisicao=${id_requisicao} status=${statusCode}`,
      )

      // Busca o pagamento pelo id_requisicao (externalId)
      const payment = await this.prisma.payment.findFirst({
        where: {
          OR: [
            { externalId: id_requisicao },
            { order: { id: id_externo } },
          ],
        },
      })

      if (!payment) {
        this.logger.warn(`[Webhook] Pagamento não encontrado: id_externo=${id_externo}`)
        continue
      }

      // Log do evento
      await this.prisma.paymentWebhookEvent.create({
        data: {
          paymentId: payment.id,
          event: `status_${statusCode}`,
          payload: registro as any,
          processed: false,
        },
      })

      // Mapeamento de status Valorem → interno
      const { dbPaymentStatus, dbOrderStatus } = this.resolveStatuses(statusCode)

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: dbPaymentStatus,
          paidAt: dbPaymentStatus === 'APPROVED' ? new Date() : undefined,
        },
      })

      await this.prisma.order.update({
        where: { id: payment.orderId },
        data: { status: dbOrderStatus },
      })

      await this.prisma.paymentWebhookEvent.updateMany({
        where: { paymentId: payment.id, processed: false },
        data: { processed: true },
      })

      this.logger.log(
        `[Webhook] Pedido ${payment.orderId} → ${dbOrderStatus} (status Valorem: ${statusCode} — ${mensagem || ''})`,
      )

      // Envia e-mail de confirmação quando pagamento é aprovado via webhook
      if (dbOrderStatus === 'PAID') {
        this.dispatchPaymentConfirmedEmail(payment.orderId)
      }
    }

    // Resposta obrigatória pela Valorem para evitar reenvio
    return { ok: true, msg: null }
  }

  private async dispatchPaymentConfirmedEmail(orderId: string) {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          items: true,
          store: { include: { tenant: { select: { email: true } } } },
        },
      })

      if (!order?.customer) return

      const emailData = {
        orderId: order.id,
        customerName: order.customer.name,
        customerEmail: order.customer.email,
        storeName: (order as any).store?.name ?? 'Sua Loja',
        storeEmail: (order as any).store?.tenant?.email,
        items: (order as any).items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: Number(item.price),
        })),
        subtotal: Number(order.subtotal),
        discount: Number(order.discount),
        total: Number(order.total),
        paymentMethod: 'WHITE_LABEL',
        status: 'PAID',
      }

      await Promise.all([
        this.notifications.sendPaymentConfirmed(emailData),
        this.notifications.sendNewOrderAlert(emailData),
      ])
    } catch {
      // silently ignore
    }
  }

  // -------------------------------------------------------
  // Cancelamento / Estorno — chamado pelo OrdersController
  // -------------------------------------------------------
  async refundPayment(orderId: string, partialAmount?: number) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId, status: 'APPROVED' },
    })
    if (!payment) throw new BadRequestException('Pagamento confirmado não encontrado')
    if (!payment.externalId) throw new BadRequestException('ID externo do pagamento não disponível')

    await this.valoremProvider.cancelPayment(payment.externalId, partialAmount)

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'CANCELLED' },
    })

    return { ok: true }
  }

  // -------------------------------------------------------
  // Utilitário: mapeia status Valorem → status internos
  // -------------------------------------------------------
  private resolveStatuses(statusCode: number): {
    dbPaymentStatus: any
    dbOrderStatus: any
  } {
    switch (statusCode) {
      case ValoremStatus.CONFIRMADO:
      case ValoremStatus.LIQUIDADO:
        return { dbPaymentStatus: 'APPROVED', dbOrderStatus: 'PAID' }

      case ValoremStatus.CANCELADO:
        return { dbPaymentStatus: 'CANCELLED', dbOrderStatus: 'CANCELLED' }

      case ValoremStatus.REEMBOLSADO:
        return { dbPaymentStatus: 'REFUNDED', dbOrderStatus: 'REFUNDED' }

      case ValoremStatus.NEGADO:
      case ValoremStatus.EXPIRADO:
      case ValoremStatus.ERRO_CONFIRMACAO:
      case ValoremStatus.FALHA:
      case ValoremStatus.ERRO_AUTORIZACAO:
      case ValoremStatus.ERRO_REEMBOLSO:
      case ValoremStatus.EXPIRACAO_REMBOLSO:
        return { dbPaymentStatus: 'FAILED', dbOrderStatus: 'CANCELLED' }

      case ValoremStatus.EM_PROGRESSO:
      default:
        return { dbPaymentStatus: 'PROCESSING', dbOrderStatus: 'AWAITING_PAYMENT' }
    }
  }
}
