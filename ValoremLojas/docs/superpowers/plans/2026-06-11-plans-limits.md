# Plano de Assinatura — Limites de Uso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o `PlansModule` que aplica limites de produtos por plano, expõe um endpoint de uso para o dashboard e exibe cards de progresso no painel admin.

**Architecture:** `PlansService` centralizado com constantes de limite e métodos `getUsage` / `checkProductLimit` / `checkStoreLimit`. `PlansModule` exporta `PlansService` e é importado por `ProductsModule`. `PlansController` expõe `GET /plan/usage`. Frontend consome esse endpoint no dashboard admin.

**Tech Stack:** NestJS, Prisma, Next.js 14, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-06-11-plans-limits-design.md`

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `apps/api/src/modules/plans/plans.service.ts` | Criar |
| `apps/api/src/modules/plans/plans.controller.ts` | Criar |
| `apps/api/src/modules/plans/plans.module.ts` | Criar |
| `apps/api/src/app.module.ts` | Modificar — registrar PlansModule |
| `apps/api/src/modules/products/products.module.ts` | Modificar — importar PlansModule |
| `apps/api/src/modules/products/products.service.ts` | Modificar — injetar PlansService + checkProductLimit em create |
| `apps/web/app/(admin)/admin/page.tsx` | Modificar — seção de plano no dashboard |

---

## Task 1: Criar PlansModule — service, controller, module

**Files:**
- Create: `apps/api/src/modules/plans/plans.service.ts`
- Create: `apps/api/src/modules/plans/plans.controller.ts`
- Create: `apps/api/src/modules/plans/plans.module.ts`

- [ ] **Step 1: Criar plans.service.ts**

Criar `apps/api/src/modules/plans/plans.service.ts` com o conteúdo:

```typescript
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../infra/database/prisma.service'
import { Plan } from '@prisma/client'

export const PLAN_LIMITS: Record<Plan, { stores: number; productsPerStore: number }> = {
  BASIC:      { stores: 1,        productsPerStore: 30  },
  PRO:        { stores: 3,        productsPerStore: 300 },
  ENTERPRISE: { stores: Infinity, productsPerStore: Infinity },
}

export interface UsageResult {
  plan: Plan
  limits: { stores: number | null; productsPerStore: number | null }
  usage:  { stores: number; products: number }
  warnings: { stores: boolean; products: boolean }
}

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  private upgradeMessage(current: Plan): string {
    if (current === Plan.BASIC) return 'Faça upgrade para o plano PRO.'
    if (current === Plan.PRO)   return 'Faça upgrade para o plano ENTERPRISE.'
    return ''
  }

  private finite(n: number): number | null {
    return n === Infinity ? null : n
  }

  async getUsage(storeId: string): Promise<UsageResult> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { tenant: true },
    })
    if (!store) throw new NotFoundException('Loja não encontrada')

    const plan = store.tenant.plan
    const limits = PLAN_LIMITS[plan]

    const [products, stores] = await Promise.all([
      this.prisma.product.count({ where: { storeId } }),
      this.prisma.store.count({ where: { tenantId: store.tenantId } }),
    ])

    return {
      plan,
      limits: {
        stores: this.finite(limits.stores),
        productsPerStore: this.finite(limits.productsPerStore),
      },
      usage: { stores, products },
      warnings: {
        products: limits.productsPerStore !== Infinity && products / limits.productsPerStore >= 0.8,
        stores:   limits.stores !== Infinity          && stores   / limits.stores           >= 0.8,
      },
    }
  }

  async checkProductLimit(storeId: string): Promise<void> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { tenant: true },
    })
    if (!store) throw new NotFoundException('Loja não encontrada')

    const { plan } = store.tenant
    const limit = PLAN_LIMITS[plan].productsPerStore
    if (limit === Infinity) return

    const count = await this.prisma.product.count({ where: { storeId } })
    if (count >= limit) {
      throw new ForbiddenException(
        `Limite de produtos atingido (${count}/${limit}). ${this.upgradeMessage(plan)}`,
      )
    }
  }

  async checkStoreLimit(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } })
    if (!tenant) throw new NotFoundException('Tenant não encontrado')

    const limit = PLAN_LIMITS[tenant.plan].stores
    if (limit === Infinity) return

    const count = await this.prisma.store.count({ where: { tenantId } })
    if (count >= limit) {
      throw new ForbiddenException(
        `Limite de lojas atingido (${count}/${limit}). ${this.upgradeMessage(tenant.plan)}`,
      )
    }
  }
}
```

- [ ] **Step 2: Criar plans.controller.ts**

Criar `apps/api/src/modules/plans/plans.controller.ts` com o conteúdo:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { PlansService } from './plans.service'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { StoreId } from '../../common/decorators/tenant.decorator'

@ApiTags('Plans')
@Controller('plan')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('usage')
  getUsage(@StoreId() storeId: string) {
    return this.plansService.getUsage(storeId)
  }
}
```

- [ ] **Step 3: Criar plans.module.ts**

Criar `apps/api/src/modules/plans/plans.module.ts` com o conteúdo:

```typescript
import { Module } from '@nestjs/common'
import { PlansController } from './plans.controller'
import { PlansService } from './plans.service'

@Module({
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/plans/
git commit -m "feat: add PlansModule with usage stats, product limit check, store limit check"
```

---

## Task 2: Registrar PlansModule e wiring em ProductsService

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/modules/products/products.module.ts`
- Modify: `apps/api/src/modules/products/products.service.ts`

- [ ] **Step 1: Registrar PlansModule no AppModule**

Em `apps/api/src/app.module.ts`, adicionar o import:

```typescript
import { PlansModule } from './modules/plans/plans.module'
```

E adicionar `PlansModule` ao array `imports` após `InventoryModule`:

```typescript
    InventoryModule,
    PlansModule,
```

- [ ] **Step 2: Importar PlansModule em ProductsModule**

Em `apps/api/src/modules/products/products.module.ts`, substituir o conteúdo completo:

```typescript
import { Module } from '@nestjs/common'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'
import { SearchModule } from '../search/search.module'
import { MediaModule } from '../media/media.module'
import { PlansModule } from '../plans/plans.module'

@Module({
  imports: [SearchModule, MediaModule, PlansModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

- [ ] **Step 3: Injetar PlansService em ProductsService**

Em `apps/api/src/modules/products/products.service.ts`:

**3a — Adicionar import no topo do arquivo:**
```typescript
import { PlansService } from '../plans/plans.service'
```

**3b — Atualizar o constructor** (substituir o constructor existente):
```typescript
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cache: Cache,
    @Optional() private readonly searchService?: SearchService,
    @Optional() private readonly mediaService?: MediaService,
    private readonly plansService?: PlansService,
  ) {}
```

Nota: `plansService` é marcado como opcional (`?`) para compatibilidade com testes que não injetam o módulo todo.

**3c — Adicionar verificação de limite no método `create`:**

Substituir o método `create` completo:

```typescript
  async create(storeId: string, data: any) {
    await this.plansService?.checkProductLimit(storeId)
    const product = await this.prisma.product.create({
      data: { ...data, storeId },
      include: {
        images: { take: 1, orderBy: { order: 'asc' } },
        category: { select: { name: true } },
        variants: { where: { active: true }, select: { price: true, stock: true } },
      },
    })
    await this.cache.del(this.cacheKey(storeId))
    this.indexProduct(product)
    return product
  }
```

- [ ] **Step 4: Build para verificar TypeScript**

```bash
cd apps/api
npx tsc --noEmit
```

Saída esperada: nenhum erro.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/modules/products/
git commit -m "feat: enforce product plan limit on create, register PlansModule"
```

---

## Task 3: Frontend — seção de plano no dashboard admin

**Files:**
- Modify: `apps/web/app/(admin)/admin/page.tsx`

O dashboard atual (`apps/web/app/(admin)/admin/page.tsx`) busca pedidos via `api.get('/orders?page=1', { token })` em um `useEffect`. A página usa as variáveis de estado `orders` e `loading`.

- [ ] **Step 1: Adicionar estado de usage**

Após `const [loading, setLoading] = useState(true)`, adicionar:

```typescript
  const [usage, setUsage] = useState<any>(null)
```

- [ ] **Step 2: Buscar /plan/usage no useEffect existente**

Dentro do `useEffect`, após a chamada de orders, adicionar o fetch de usage em paralelo. Substituir o bloco do `useEffect` completo:

```typescript
  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { window.location.href = '/admin/login'; return }

    Promise.all([
      api.get('/orders?page=1', { token }),
      api.get('/plan/usage', { token }).catch(() => null),
    ]).then(([ordersData, usageData]) => {
      setOrders(ordersData)
      setUsage(usageData)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])
```

Nota: o fetch de `/plan/usage` usa `.catch(() => null)` para nunca quebrar o dashboard se o endpoint falhar.

- [ ] **Step 3: Adicionar seção de plano no JSX**

No JSX do componente, localizar a linha que renderiza o título `<h1 className="text-2xl font-bold mb-6">Dashboard</h1>`. Logo após esse `<h1>`, adicionar a seção de plano:

```tsx
      {/* Seção de plano — não exibe para ENTERPRISE nem quando não carregou */}
      {usage && usage.plan !== 'ENTERPRISE' && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Plano</span>
              <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2 py-1 rounded-full uppercase">
                {usage.plan}
              </span>
            </div>
            <a href="#" className="text-sm text-blue-600 hover:underline font-medium">
              Upgrade →
            </a>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              {
                label: 'Produtos',
                current: usage.usage.products,
                max: usage.limits.productsPerStore,
                warning: usage.warnings.products,
              },
              {
                label: 'Lojas',
                current: usage.usage.stores,
                max: usage.limits.stores,
                warning: usage.warnings.stores,
              },
            ].map((item) => {
              const pct = item.max ? Math.min(100, Math.round((item.current / item.max) * 100)) : 0
              const barColor =
                pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-yellow-400' : 'bg-green-500'
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{item.label}</span>
                    <span className="text-gray-500 tabular-nums">
                      {item.current}/{item.max ?? '∞'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {pct >= 100 && (
                    <p className="text-xs text-red-600 mt-1 font-medium">No limite — faça upgrade</p>
                  )}
                  {item.warning && pct < 100 && (
                    <p className="text-xs text-yellow-600 mt-1">⚠ {pct}% do limite</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(admin)/admin/page.tsx
git commit -m "feat: add plan usage section to admin dashboard"
```
