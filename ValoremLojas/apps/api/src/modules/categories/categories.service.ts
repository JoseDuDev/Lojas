import { Injectable, NotFoundException, Inject } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { PrismaService } from '../../infra/database/prisma.service'

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  private cacheKey(storeId: string) {
    return `categories:${storeId}`
  }

  async findAll(storeId: string, includeInactive = false) {
    if (!includeInactive) {
      const cached = await this.cache.get(this.cacheKey(storeId))
      if (cached) return cached
    }

    const categories = await this.prisma.category.findMany({
      where: {
        storeId,
        parentId: null,
        ...(includeInactive ? {} : { active: true }),
      },
      include: {
        children: {
          where: includeInactive ? {} : { active: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { products: true } },
      },
      orderBy: { name: 'asc' },
    })

    if (!includeInactive) {
      await this.cache.set(this.cacheKey(storeId), categories, 300)
    }

    return categories
  }

  async findFlat(storeId: string) {
    return this.prisma.category.findMany({
      where: { storeId },
      select: { id: true, name: true, slug: true, parentId: true, active: true },
      orderBy: { name: 'asc' },
    })
  }

  async findBySlug(storeId: string, slug: string) {
    const category = await this.prisma.category.findUnique({
      where: { storeId_slug: { storeId, slug } },
      include: {
        products: {
          where: { active: true },
          include: { images: { take: 1, orderBy: { order: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        },
        children: { where: { active: true } },
      },
    })
    if (!category) throw new NotFoundException('Categoria não encontrada')
    return category
  }

  async create(storeId: string, data: any) {
    const category = await this.prisma.category.create({
      data: { ...data, storeId },
    })
    await this.cache.del(this.cacheKey(storeId))
    return category
  }

  async update(storeId: string, id: string, data: any) {
    await this.ensureOwnership(storeId, id)
    const category = await this.prisma.category.update({
      where: { id },
      data,
    })
    await this.cache.del(this.cacheKey(storeId))
    return category
  }

  async remove(storeId: string, id: string) {
    await this.ensureOwnership(storeId, id)
    // Desvincula produtos antes de excluir
    await this.prisma.product.updateMany({
      where: { storeId, categoryId: id },
      data: { categoryId: null },
    })
    // Move subcategorias para raiz
    await this.prisma.category.updateMany({
      where: { storeId, parentId: id },
      data: { parentId: null },
    })
    await this.prisma.category.delete({ where: { id } })
    await this.cache.del(this.cacheKey(storeId))
  }

  private async ensureOwnership(storeId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, storeId },
    })
    if (!category) throw new NotFoundException('Categoria não encontrada')
    return category
  }
}
