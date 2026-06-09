import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../infra/database/prisma.service'

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(storeId: string, filters?: { status?: string; page?: number }) {
    const page = filters?.page || 1
    const take = 20

    return this.prisma.order.findMany({
      where: {
        storeId,
        ...(filters?.status && { status: filters.status as any }),
      },
      include: {
        customer: { select: { name: true, email: true } },
        items: { include: { product: { select: { name: true } } } },
        payment: { select: { status: true, method: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * take,
      take,
    })
  }

  async findOne(storeId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, storeId },
      include: {
        customer: true,
        items: { include: { product: { include: { images: { take: 1 } } } } },
        payment: true,
      },
    })

    if (!order) throw new NotFoundException('Pedido não encontrado')
    return order
  }

  async updateStatus(storeId: string, id: string, status: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, storeId },
    })
    if (!order) throw new NotFoundException('Pedido não encontrado')

    return this.prisma.order.update({
      where: { id },
      data: { status: status as any },
    })
  }

  // Rota pública — status básico para a página de confirmação do checkout
  async getPublicStatus(storeId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, storeId },
      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,
        customer: { select: { name: true } },
        payment: { select: { status: true, method: true } },
      },
    })
    if (!order) throw new NotFoundException('Pedido não encontrado')
    return order
  }
}
