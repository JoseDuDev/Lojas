import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../infra/database/prisma.service'

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  async findBySubdomain(subdomain: string) {
    const store = await this.prisma.store.findUnique({
      where: { subdomain },
      include: { storeSettings: true },
    })
    if (!store) throw new NotFoundException('Loja não encontrada')
    return store
  }

  async getPublicInfo(storeId: string) {
    return this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true, name: true, logoUrl: true,
        primaryColor: true, secondaryColor: true,
        description: true, storeSettings: true,
      },
    })
  }

  async updateSettings(storeId: string, data: any) {
    return this.prisma.store.update({
      where: { id: storeId },
      data,
    })
  }
}
