import { Module } from '@nestjs/common'
import { PaymentsController } from './payments.controller'
import { PaymentsService } from './payments.service'
import { ValoremPaymentProvider } from './providers/valorem.provider'

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, ValoremPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
