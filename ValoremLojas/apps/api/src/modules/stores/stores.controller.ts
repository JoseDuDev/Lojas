import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { StoresService } from './stores.service'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { StoreId } from '../../common/decorators/tenant.decorator'

@ApiTags('Store')
@Controller('store')
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  // Rota pública — info da loja (logo, cores)
  @Get()
  getPublicInfo(@StoreId() storeId: string) {
    return this.storesService.getPublicInfo(storeId)
  }

  // Rota admin — atualiza configurações
  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateSettings(@StoreId() storeId: string, @Body() body: any) {
    return this.storesService.updateSettings(storeId, body)
  }
}
