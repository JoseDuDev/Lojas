import { Controller, Post, Body, Param, Logger, HttpCode } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { PaymentsService, ProcessPaymentDto } from './payments.service'
import { ValoremWebhookPayload } from './providers/valorem.provider'

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name)

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Processa pagamento para um pedido existente.
   * Chamado internamente pelo CheckoutService — mas também disponível
   * para fluxos de retry/reprocessamento via admin.
   */
  @Post('order/:orderId')
  @ApiOperation({ summary: 'Processar pagamento de um pedido' })
  processPayment(
    @Param('orderId') orderId: string,
    @Body() body: ProcessPaymentDto,
  ) {
    return this.paymentsService.processPayment(orderId, body)
  }

  /**
   * Webhook recebido da plataforma Valorem Pay.
   *
   * A Valorem envia POST com { registros: [...] } contendo status numérico.
   * Retorno obrigatório: { ok: true, msg: null } para evitar reenvio.
   *
   * Configure a URL deste endpoint no painel Valorem:
   *   https://sua-api.com/payments/webhook
   */
  @Post('webhook')
  @HttpCode(200)
  @ApiOperation({ summary: 'Webhook Valorem Pay — não requer autenticação' })
  handleWebhook(@Body() body: ValoremWebhookPayload) {
    this.logger.log(`[Webhook] Recebido: ${JSON.stringify(body?.registros?.map(r => ({
      id_externo: r.id_externo,
      status: r.status,
      mensagem: r.mensagem,
    })))}`)
    return this.paymentsService.handleWebhook(body)
  }

  /**
   * Estorno / cancelamento de pagamento.
   * Se valor omitido: estorno total (mesmo dia).
   * Se valor informado: cancelamento parcial (dias posteriores).
   */
  @Post('order/:orderId/refund')
  @ApiOperation({ summary: 'Estornar pagamento' })
  refund(
    @Param('orderId') orderId: string,
    @Body('valor') valor?: number,
  ) {
    return this.paymentsService.refundPayment(orderId, valor)
  }
}
