import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { EmailProcessor } from './processors/email.processor'
import { SearchIndexProcessor } from './processors/search.processor'
import { JobsController } from './jobs.controller'
import { QUEUE_EMAIL, QUEUE_SEARCH } from './jobs.constants'

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_EMAIL }),
    BullModule.registerQueue({ name: QUEUE_SEARCH }),
  ],
  controllers: [JobsController],
  providers: [EmailProcessor, SearchIndexProcessor],
})
export class JobsModule {}
