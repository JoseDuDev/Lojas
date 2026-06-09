import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bull'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'
import { QUEUE_SEARCH } from '../jobs/jobs.constants'

@Module({
  imports: [BullModule.registerQueue({ name: QUEUE_SEARCH })],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
