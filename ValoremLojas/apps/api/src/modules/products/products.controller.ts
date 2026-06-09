import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, HttpCode,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ProductsService } from './products.service'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { StoreId } from '../../common/decorators/tenant.decorator'
import { IsString, IsNumber, IsOptional } from 'class-validator'
import { Type } from 'class-transformer'

class CreateProductDto {
  @IsString() name: string
  @IsString() slug: string
  @IsOptional() @IsString() description?: string
  @IsNumber() @Type(() => Number) price: number
  @IsOptional() @IsNumber() @Type(() => Number) comparePrice?: number
  @IsOptional() @IsNumber() @Type(() => Number) stock?: number
  @IsOptional() @IsString() sku?: string
  @IsOptional() @IsString() categoryId?: string
}

class AddImageDto {
  @IsString() url: string
  @IsOptional() @IsString() alt?: string
}

@ApiTags('Products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // Rota pública — storefront
  @Get()
  findAll(
    @StoreId() storeId: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll(storeId, { category, search })
  }

  // Rota pública — detalhe do produto
  @Get(':slug')
  findOne(@StoreId() storeId: string, @Param('slug') slug: string) {
    return this.productsService.findBySlug(storeId, slug)
  }

  // Rotas admin (protegidas)
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@StoreId() storeId: string, @Body() dto: CreateProductDto) {
    return this.productsService.create(storeId, dto)
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateProductDto>,
  ) {
    return this.productsService.update(storeId, id, dto)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  remove(@StoreId() storeId: string, @Param('id') id: string) {
    return this.productsService.remove(storeId, id)
  }

  // Gestão de imagens
  @Get(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getImages(@StoreId() storeId: string, @Param('id') id: string) {
    return this.productsService.getImages(storeId, id)
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  addImage(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body() dto: AddImageDto,
  ) {
    return this.productsService.addImage(storeId, id, dto)
  }

  @Delete(':id/images/:imageId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  removeImage(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.productsService.removeImage(storeId, id, imageId)
  }
}
