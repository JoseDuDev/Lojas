import { Processor, Process } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import * as nodemailer from 'nodemailer'
import {
  QUEUE_EMAIL,
  JOB_EMAIL_ORDER_CONFIRMATION,
  JOB_EMAIL_PAYMENT_CONFIRMED,
  JOB_EMAIL_NEW_ORDER_ALERT,
} from '../jobs.constants'
import type { OrderEmailData } from '../../notifications/notifications.service'

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

@Processor(QUEUE_EMAIL)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name)
  private transporter: nodemailer.Transporter | null = null

  constructor() {
    const host = process.env.MAIL_HOST
    const port = Number(process.env.MAIL_PORT || 587)
    const user = process.env.MAIL_USER
    const pass = process.env.MAIL_PASS

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      })
    }
  }

  @Process(JOB_EMAIL_ORDER_CONFIRMATION)
  async handleOrderConfirmation(job: Job<OrderEmailData>) {
    await this.send(job.data, {
      subject: `Pedido #${job.data.orderId.slice(-8).toUpperCase()} recebido — ${job.data.storeName}`,
      headline: 'Pedido recebido!',
      intro: `Olá, <strong>${job.data.customerName}</strong>! Recebemos seu pedido e em breve você receberá a confirmação do pagamento.`,
      badge: { label: 'Aguardando pagamento', color: '#f59e0b' },
      to: job.data.customerEmail,
    })
  }

  @Process(JOB_EMAIL_PAYMENT_CONFIRMED)
  async handlePaymentConfirmed(job: Job<OrderEmailData>) {
    await this.send(job.data, {
      subject: `Pagamento confirmado — Pedido #${job.data.orderId.slice(-8).toUpperCase()}`,
      headline: 'Pagamento confirmado!',
      intro: `Olá, <strong>${job.data.customerName}</strong>! Seu pagamento foi aprovado e seu pedido está sendo preparado.`,
      badge: { label: 'Pagamento aprovado', color: '#10b981' },
      to: job.data.customerEmail,
    })
  }

  @Process(JOB_EMAIL_NEW_ORDER_ALERT)
  async handleNewOrderAlert(job: Job<OrderEmailData>) {
    if (!job.data.storeEmail) return
    await this.send(job.data, {
      subject: `Novo pedido #${job.data.orderId.slice(-8).toUpperCase()} — ${brl(job.data.total)}`,
      headline: 'Novo pedido recebido!',
      intro: `Um novo pedido foi registrado na sua loja <strong>${job.data.storeName}</strong>.`,
      badge: { label: 'Novo pedido', color: '#6366f1' },
      to: job.data.storeEmail,
      isAdmin: true,
    })
  }

  private async send(
    data: OrderEmailData,
    opts: { subject: string; headline: string; intro: string; badge: { label: string; color: string }; to: string; isAdmin?: boolean },
  ) {
    if (!this.transporter) {
      this.logger.warn('Mailer não configurado — e-mail ignorado')
      return
    }
    const from = process.env.MAIL_FROM || `"Valorem Lojas" <noreply@valoremlojas.com.br>`
    const html = buildOrderEmail(data, opts)
    await this.transporter.sendMail({ from, to: opts.to, subject: opts.subject, html })
    this.logger.log(`E-mail enviado para ${opts.to}: ${opts.subject}`)
  }
}

// ---------------------------------------------------------------------------
// Template HTML
// ---------------------------------------------------------------------------
function buildOrderEmail(
  data: OrderEmailData,
  opts: { headline: string; intro: string; badge: { label: string; color: string }; isAdmin?: boolean },
): string {
  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px">${item.name}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:center">${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px;text-align:right">${brl(item.price * item.quantity)}</td>
      </tr>`,
    )
    .join('')

  const discountRow =
    data.discount > 0
      ? `<tr>
           <td colspan="2" style="padding:6px 0;font-size:13px;color:#6b7280">Desconto</td>
           <td style="padding:6px 0;font-size:13px;color:#10b981;text-align:right">− ${brl(data.discount)}</td>
         </tr>`
      : ''

  const adminRow = opts.isAdmin
    ? `<tr>
         <td style="font-size:13px;color:#6b7280;padding:4px 0">Cliente</td>
         <td style="font-size:13px;color:#18181b;text-align:right;padding:4px 0">${data.customerName} &lt;${data.customerEmail}&gt;</td>
       </tr>`
    : ''

  const year = new Date().getFullYear()

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <tr>
          <td style="background:#18181b;padding:28px 32px;text-align:center">
            <p style="margin:0;color:#fff;font-size:20px;font-weight:700">${data.storeName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <div style="text-align:center;margin-bottom:24px">
              <span style="display:inline-block;background:${opts.badge.color};color:#fff;font-size:13px;font-weight:600;padding:6px 16px;border-radius:999px">
                ${opts.badge.label}
              </span>
            </div>
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#18181b;text-align:center">${opts.headline}</h1>
            <p style="margin:0 0 28px;font-size:15px;color:#6b7280;text-align:center;line-height:1.6">${opts.intro}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;padding:16px;margin-bottom:24px">
              <tr>
                <td style="font-size:13px;color:#6b7280;padding:4px 0">Número do pedido</td>
                <td style="font-size:13px;font-weight:600;color:#18181b;text-align:right;padding:4px 0;font-family:monospace">
                  #${data.orderId.slice(-8).toUpperCase()}
                </td>
              </tr>
              ${data.paymentMethod ? `<tr>
                <td style="font-size:13px;color:#6b7280;padding:4px 0">Pagamento</td>
                <td style="font-size:13px;color:#18181b;text-align:right;padding:4px 0">${data.paymentMethod}</td>
              </tr>` : ''}
              ${adminRow}
            </table>
            <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Itens do pedido</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px">
              <thead>
                <tr>
                  <th style="text-align:left;font-size:12px;color:#9ca3af;font-weight:500;padding-bottom:8px;border-bottom:1px solid #e5e7eb">Produto</th>
                  <th style="text-align:center;font-size:12px;color:#9ca3af;font-weight:500;padding-bottom:8px;border-bottom:1px solid #e5e7eb">Qtd</th>
                  <th style="text-align:right;font-size:12px;color:#9ca3af;font-weight:500;padding-bottom:8px;border-bottom:1px solid #e5e7eb">Total</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
              <tr>
                <td colspan="2" style="padding:6px 0;font-size:13px;color:#6b7280">Subtotal</td>
                <td style="padding:6px 0;font-size:13px;color:#18181b;text-align:right">${brl(data.subtotal)}</td>
              </tr>
              ${discountRow}
              <tr>
                <td colspan="2" style="padding:8px 0 0;font-size:15px;font-weight:700;color:#18181b;border-top:2px solid #18181b">Total</td>
                <td style="padding:8px 0 0;font-size:15px;font-weight:700;color:#18181b;text-align:right;border-top:2px solid #18181b">${brl(data.total)}</td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#9ca3af;text-align:center">Dúvidas? Responda este e-mail.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;text-align:center">
            <p style="margin:0;font-size:12px;color:#9ca3af">© ${year} ${data.storeName}. Todos os direitos reservados.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
