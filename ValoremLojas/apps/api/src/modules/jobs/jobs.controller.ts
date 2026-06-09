import { Controller, Get, Delete, Param, UseGuards, HttpCode } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { QUEUE_EMAIL, QUEUE_SEARCH } from './jobs.constants'

@ApiTags('Jobs')
@Controller('admin/jobs')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class JobsController {
  constructor(
    @InjectQueue(QUEUE_EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(QUEUE_SEARCH) private readonly searchQueue: Queue,
  ) {}

  @Get()
  async overview() {
    const [emailCounts, searchCounts] = await Promise.all([
      this.emailQueue.getJobCounts(),
      this.searchQueue.getJobCounts(),
    ])
    return {
      queues: {
        email: emailCounts,
        search: searchCounts,
      },
    }
  }

  @Get('email/failed')
  async emailFailed() {
    const jobs = await this.emailQueue.getFailed(0, 49)
    return jobs.map((j) => ({
      id: j.id,
      name: j.name,
      failedReason: j.failedReason,
      attemptsMade: j.attemptsMade,
      timestamp: j.timestamp,
    }))
  }

  @Delete('email/failed')
  @HttpCode(204)
  async clearEmailFailed() {
    await this.emailQueue.clean(0, 'failed')
  }

  @Delete('email/failed/:jobId')
  @HttpCode(204)
  async retryEmailJob(@Param('jobId') jobId: string) {
    const job = await this.emailQueue.getJob(jobId)
    if (job) await job.retry()
  }

  @Get('search/failed')
  async searchFailed() {
    const jobs = await this.searchQueue.getFailed(0, 49)
    return jobs.map((j) => ({
      id: j.id,
      name: j.name,
      failedReason: j.failedReason,
      attemptsMade: j.attemptsMade,
      timestamp: j.timestamp,
    }))
  }

  @Delete('search/failed')
  @HttpCode(204)
  async clearSearchFailed() {
    await this.searchQueue.clean(0, 'failed')
  }
}
