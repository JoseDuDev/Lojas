import { Controller, Get, Put, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { OrdersService } from './orders.service'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { StoreId } from '../../common/decorators/tenant.decorator'

@ApiTags('Orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Admin — requer autenticação
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findAll(
    @StoreId() storeId: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
  ) {
    return this.ordersService.findAll(storeId, { status, page })
  }

  // Público — status básico para a página de confirmação (retorna apenas dados não sensíveis)
  @Get(':id/status')
  getPublicStatus(@StoreId() storeId: string, @Param('id') id: string) {
    return this.ordersService.getPublicStatus(storeId, id)
  }

  // Admin — requer autenticação
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findOne(@StoreId() storeId: string, @Param('id') id: string) {
    return this.ordersService.findOne(storeId, id)
  }

  @Put(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateStatus(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.ordersService.updateStatus(storeId, id, status)
  }
}
