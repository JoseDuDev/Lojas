import {
  Controller, Get, Post, Put, Delete,
  Param, Body, UseGuards, HttpCode,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { IsString, IsNumber, IsOptional, IsEnum, IsDateString } from 'class-validator'
import { Type } from 'class-transformer'
import { CouponsService } from './coupons.service'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { StoreId } from '../../common/decorators/tenant.decorator'

enum CouponType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

class CreateCouponDto {
  @IsString() code: string
  @IsEnum(CouponType) type: CouponType
  @IsNumber() @Type(() => Number) value: number
  @IsOptional() @IsNumber() @Type(() => Number) minValue?: number
  @IsOptional() @IsNumber() @Type(() => Number) maxUses?: number
  @IsOptional() @IsDateString() expiresAt?: string
}

class ValidateCouponDto {
  @IsString() code: string
  @IsNumber() @Type(() => Number) orderTotal: number
}

@ApiTags('Coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  // Admin — lista todos os cupons
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findAll(@StoreId() storeId: string) {
    return this.couponsService.findAll(storeId)
  }

  // Público — valida um cupom no checkout
  @Post('validate')
  validateCoupon(@StoreId() storeId: string, @Body() dto: ValidateCouponDto) {
    return this.couponsService.validate(storeId, dto.code, dto.orderTotal)
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findOne(@StoreId() storeId: string, @Param('id') id: string) {
    return this.couponsService.findOne(storeId, id)
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@StoreId() storeId: string, @Body() dto: CreateCouponDto) {
    return this.couponsService.create(storeId, dto)
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateCouponDto> & { active?: boolean },
  ) {
    return this.couponsService.update(storeId, id, dto)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  remove(@StoreId() storeId: string, @Param('id') id: string) {
    return this.couponsService.remove(storeId, id)
  }
}
