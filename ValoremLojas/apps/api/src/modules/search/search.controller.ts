import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { SearchService } from './search.service'
import { PrismaService } from '../../infra/database/prisma.service'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { StoreId } from '../../common/decorators/tenant.decorator'
import type { ProductDocument } from './search.service'

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly prisma: PrismaService,
  ) {}

  // Público — busca de produtos do storefront
  @Get()
  search(
    @StoreId() storeId: string,
    @Query('q') q: string = '',
    @Query('categoryId') categoryId?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('featured') featured?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('sort') sort?: string,
  ) {
    return this.searchService.search(storeId, q, {
      categoryId,
      minPrice: minPrice !== undefined ? Number(minPrice) : undefined,
      maxPrice: maxPrice !== undefined ? Number(maxPrice) : undefined,
      featured: featured === 'true',
      limit: limit !== undefined ? Number(limit) : 20,
      offset: offset !== undefined ? Number(offset) : 0,
      sortBy: (sort as any) || undefined,
    })
  }

  // Admin — reindexa todos os produtos da loja no Meilisearch
  @Post('reindex')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async reindex(@StoreId() storeId: string) {
    const products = await this.prisma.product.findMany({
      where: { storeId },
      include: {
        images: { take: 1, orderBy: { order: 'asc' } },
        category: { select: { name: true } },
      },
    })

    const documents: ProductDocument[] = products.map((p) => ({
      id: p.id,
      storeId: p.storeId,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: Number(p.price),
      comparePrice: p.comparePrice ? Number(p.comparePrice) : null,
      stock: p.stock,
      active: p.active,
      featured: p.featured,
      categoryId: p.categoryId,
      categoryName: p.category?.name ?? null,
      imageUrl: p.images[0]?.url ?? null,
      sku: p.sku,
    }))

    return this.searchService.reindexStore(storeId, documents)
  }
}
