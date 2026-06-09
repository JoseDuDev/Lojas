import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import {
  QUEUE_EMAIL,
  JOB_EMAIL_ORDER_CONFIRMATION,
  JOB_EMAIL_PAYMENT_CONFIRMED,
  JOB_EMAIL_NEW_ORDER_ALERT,
  JOB_DEFAULT_OPTS,
} from '../jobs/jobs.constants'

export interface OrderEmailData {
  orderId: string
  customerName: string
  customerEmail: string
  storeName: string
  storeEmail?: string
  items: Array<{ name: string; quantity: number; price: number }>
  subtotal: number
  discount: number
  total: number
  paymentMethod?: string
  status: string
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    @InjectQueue(QUEUE_EMAIL) private readonly emailQueue: Queue,
  ) {}

  async sendOrderConfirmation(data: OrderEmailData) {
    await this.enqueue(JOB_EMAIL_ORDER_CONFIRMATION, data)
  }

  async sendPaymentConfirmed(data: OrderEmailData) {
    await this.enqueue(JOB_EMAIL_PAYMENT_CONFIRMED, data)
  }

  async sendNewOrderAlert(data: OrderEmailData) {
    if (!data.storeEmail) return
    await this.enqueue(JOB_EMAIL_NEW_ORDER_ALERT, data)
  }

  private async enqueue(jobName: string, data: OrderEmailData) {
    try {
      await this.emailQueue.add(jobName, data, JOB_DEFAULT_OPTS)
    } catch (e: any) {
      this.logger.warn(`Falha ao enfileirar e-mail "${jobName}": ${e.message}`)
    }
  }
}
