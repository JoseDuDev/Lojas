import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * Extrai o storeId do request (injetado pelo TenantMiddleware)
 *
 * Uso:
 * @Get('products')
 * findAll(@StoreId() storeId: string) { ... }
 */
export const StoreId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    return request.storeId
  },
)
