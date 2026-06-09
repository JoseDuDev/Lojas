import { Controller, Post, Body } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CheckoutService, CheckoutDto } from './checkout.service'
import { StoreId } from '../../common/decorators/tenant.decorator'

@ApiTags('Checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  process(@StoreId() storeId: string, @Body() dto: CheckoutDto) {
    return this.checkoutService.process(storeId, dto)
  }
}
