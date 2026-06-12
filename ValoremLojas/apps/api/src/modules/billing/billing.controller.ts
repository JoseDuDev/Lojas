import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Headers,
  UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { BillingService } from './billing.service'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { StoreId } from '../../common/decorators/tenant.decorator'
import { Plan } from '@prisma/client'

class RequestUpgradeDto {
  toPlan: Plan
}

class ApprovePlanDto {
  plan: Plan
}

class StartTrialDto {
  plan: Plan
  days: number
}

@ApiTags('Billing')
@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('billing/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getBillingStatus(@StoreId() storeId: string) {
    return this.billingService.getBillingStatus(storeId)
  }

  @Post('billing/upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  requestUpgrade(@StoreId() storeId: string, @Body() body: RequestUpgradeDto) {
    return this.billingService.requestUpgrade(storeId, body.toPlan)
  }

  @Patch('admin/tenants/:tenantId/plan')
  approvePlan(
    @Param('tenantId') tenantId: string,
    @Body() body: ApprovePlanDto,
    @Headers('x-admin-key') apiKey: string,
  ) {
    return this.billingService.approvePlan(tenantId, body.plan, apiKey)
  }

  @Patch('admin/tenants/:tenantId/requests/:requestId/reject')
  rejectRequest(
    @Param('tenantId') tenantId: string,
    @Param('requestId') requestId: string,
    @Headers('x-admin-key') apiKey: string,
  ) {
    return this.billingService.rejectRequest(tenantId, requestId, apiKey)
  }

  @Post('admin/tenants/:tenantId/trial')
  startTrial(
    @Param('tenantId') tenantId: string,
    @Body() body: StartTrialDto,
    @Headers('x-admin-key') apiKey: string,
  ) {
    return this.billingService.startTrial(tenantId, body.plan, body.days, apiKey)
  }
}
