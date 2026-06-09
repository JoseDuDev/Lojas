import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { PrismaService } from '../../infra/database/prisma.service'

@Injectable()
export class CouponsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async findAll(storeId: string) {
    return this.prisma.coupon.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(storeId: string, id: string) {
    const coupon = await this.prisma.coupon.findFirst({ where: { id, storeId } })
    if (!coupon) throw new NotFoundException('Cupom não encontrado')
    return coupon
  }

  async validate(storeId: string, code: string, orderTotal: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { storeId_code: { storeId, code: code.toUpperCase() } },
    })

    if (!coupon || !coupon.active) {
      throw new BadRequestException('Cupom inválido ou inativo')
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('Cupom expirado')
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException('Cupom atingiu o limite de usos')
    }

    if (coupon.minValue !== null && orderTotal < Number(coupon.minValue)) {
      throw new BadRequestException(
        `Pedido mínimo de ${Number(coupon.minValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para usar este cupom`,
      )
    }

    const discount =
      coupon.type === 'PERCENTAGE'
        ? orderTotal * (Number(coupon.value) / 100)
        : Math.min(Number(coupon.value), orderTotal)

    return {
      valid: true,
      coupon: { code: coupon.code, type: coupon.type, value: Number(coupon.value) },
      discount: Math.round(discount * 100) / 100,
    }
  }

  async create(storeId: string, data: any) {
    return this.prisma.coupon.create({
      data: { ...data, code: data.code.toUpperCase(), storeId },
    })
  }

  async update(storeId: string, id: string, data: any) {
    await this.findOne(storeId, id)
    return this.prisma.coupon.update({
      where: { id },
      data: { ...data, ...(data.code && { code: data.code.toUpperCase() }) },
    })
  }

  async remove(storeId: string, id: string) {
    await this.findOne(storeId, id)
    await this.prisma.coupon.delete({ where: { id } })
  }
}
