import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, HttpCode,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { IsString, IsOptional } from 'class-validator'
import { CategoriesService } from './categories.service'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { StoreId } from '../../common/decorators/tenant.decorator'

class CreateCategoryDto {
  @IsString() name: string
  @IsString() slug: string
  @IsOptional() @IsString() parentId?: string
  @IsOptional() @IsString() imageUrl?: string
}

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // Pública — hierarquia de categorias ativas (storefront)
  @Get()
  findAll(
    @StoreId() storeId: string,
    @Query('all') all?: string,
    @Query('flat') flat?: string,
  ) {
    if (flat === 'true') return this.categoriesService.findFlat(storeId)
    return this.categoriesService.findAll(storeId, all === 'true')
  }

  // Pública — categoria com produtos
  @Get(':slug')
  findOne(@StoreId() storeId: string, @Param('slug') slug: string) {
    return this.categoriesService.findBySlug(storeId, slug)
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@StoreId() storeId: string, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(storeId, dto)
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(
    @StoreId() storeId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateCategoryDto> & { active?: boolean },
  ) {
    return this.categoriesService.update(storeId, id, dto)
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(204)
  remove(@StoreId() storeId: string, @Param('id') id: string) {
    return this.categoriesService.remove(storeId, id)
  }
}
