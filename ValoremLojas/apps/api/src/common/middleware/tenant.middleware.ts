import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { PrismaService } from '../../infra/database/prisma.service'

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const host = req.headers.host || ''

    // Suporte a subdomínio E header x-tenant (para apps mobile / Postman)
    const xTenant = req.headers['x-tenant'] as string | undefined

    let subdomain: string | undefined

    if (xTenant) {
      subdomain = xTenant
    } else {
      // Remove porta se houver (ex: localhost:3001 → localhost)
      const hostname = host.split(':')[0]
      const parts = hostname.split('.')

      // subdomínio só existe se tiver 3+ partes (ex: loja.valorem.com.br)
      if (parts.length >= 3) {
        subdomain = parts[0]
      }
    }

    if (!subdomain) {
      // Sem tenant identificado — pode ser rota de plataforma (admin SaaS)
      return next()
    }

    const store = await this.prisma.store.findUnique({
      where: { subdomain },
      select: { id: true, active: true, tenantId: true },
    })

    if (!store) {
      throw new NotFoundException(`Loja "${subdomain}" não encontrada`)
    }

    if (!store.active) {
      throw new NotFoundException(`Loja "${subdomain}" está desativada`)
    }

    // Injeta o tenant no request para uso nos controllers/services
    req['tenantId'] = store.id
    req['storeId'] = store.id

    next()
  }
}
