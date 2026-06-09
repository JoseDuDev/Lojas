import { Module, Global } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { NotificationsService } from './notifications.service'
import { QUEUE_EMAIL } from '../jobs/jobs.constants'

@Global()
@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_EMAIL })],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
