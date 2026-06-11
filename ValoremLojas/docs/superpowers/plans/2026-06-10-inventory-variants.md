# Inventory — Variantes de Produto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar suporte a variantes de produto (ex: Tamanho × Cor) com preço e estoque individuais, gerenciamento admin e seletor no storefront.

**Architecture:** Cinco novos modelos Prisma (`ProductAttribute`, `AttributeValue`, `ProductVariant`, `VariantAttributeValue`, `VariantImage`) formam a espinha dorsal. Um novo módulo `InventoryModule` expõe os endpoints de atributos, variantes e imagens de variante. O `checkout.service` e o `cart` são atualizados para rastrear `variantId`. O storefront exibe seletores de atributo; o admin ganha uma aba "Variantes".

**Tech Stack:** NestJS, Prisma, PostgreSQL, Next.js 14 (App Router), Zustand, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-06-10-inventory-variants-design.md`

---

## Mapa de arquivos

| Arquivo | Ação |
|---|---|
| `packages/database/schema.prisma` | Modificar — 5 novos modelos + variantId em OrderItem + relações em Product |
| `apps/api/src/modules/inventory/inventory.module.ts` | Criar |
| `apps/api/src/modules/inventory/inventory.service.ts` | Criar |
| `apps/api/src/modules/inventory/inventory.controller.ts` | Criar |
| `apps/api/src/app.module.ts` | Modificar — registrar InventoryModule |
| `apps/api/src/modules/products/products.service.ts` | Modificar — findBySlug + indexProduct |
| `apps/api/src/modules/checkout/checkout.service.ts` | Modificar — CartItem + validação + deducão de estoque |
| `apps/web/lib/api.ts` | Modificar — adicionar api.patch |
| `apps/web/lib/cart.ts` | Modificar — variantId em CartItem + addItem/removeItem/updateQuantity |
| `apps/web/app/(storefront)/cart/page.tsx` | Modificar — passar variantId nas chamadas |
| `apps/web/app/(storefront)/checkout/page.tsx` | Modificar — incluir variantId no payload |
| `apps/web/app/(storefront)/product/[slug]/page.tsx` | Modificar — seletores de variante |
| `apps/web/app/(admin)/admin/products/page.tsx` | Modificar — aba Variantes |

---

## Task 1: Prisma Schema — novos modelos + migration

**Files:**
- Modify: `packages/database/schema.prisma`

- [ ] **Step 1: Adicionar relações ao modelo Product**

Em `packages/database/schema.prisma`, localizar o modelo `Product`. Após a linha `orderItems  OrderItem[]`, adicionar as duas novas relações:

```prisma
  orderItems  OrderItem[]
  attributes  ProductAttribute[]
  variants    ProductVariant[]
```

- [ ] **Step 2: Adicionar variantId ao modelo OrderItem**

Localizar o modelo `OrderItem`. Substituir o bloco completo:

```prisma
model OrderItem {
  id         String  @id @default(uuid())
  orderId    String
  productId  String
  name       String  // snapshot do nome
  price      Decimal // snapshot do preço
  quantity   Int

  order      Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product    Product @relation(fields: [productId], references: [id])

  @@map("order_items")
}
```

Por:

```prisma
model OrderItem {
  id         String  @id @default(uuid())
  orderId    String
  productId  String
  variantId  String?
  name       String
  price      Decimal
  quantity   Int

  order      Order              @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product    Product            @relation(fields: [productId], references: [id])
  variant    ProductVariant?    @relation(fields: [variantId], references: [id])

  @@map("order_items")
}
```

- [ ] **Step 3: Adicionar os 5 novos modelos ao schema**

Após o bloco `model ProductImage { ... @@map("product_images") }`, antes do comentário `// === CATEGORIA ===`, inserir:

```prisma
model ProductAttribute {
  id        String           @id @default(uuid())
  productId String
  storeId   String
  name      String
  position  Int              @default(0)

  product   Product          @relation(fields: [productId], references: [id], onDelete: Cascade)
  values    AttributeValue[]

  @@index([productId])
  @@map("product_attributes")
}

model AttributeValue {
  id          String                   @id @default(uuid())
  attributeId String
  value       String
  position    Int                      @default(0)

  attribute     ProductAttribute         @relation(fields: [attributeId], references: [id], onDelete: Cascade)
  variantValues VariantAttributeValue[]

  @@index([attributeId])
  @@map("attribute_values")
}

model ProductVariant {
  id           String    @id @default(uuid())
  productId    String
  storeId      String
  sku          String?
  price        Decimal
  comparePrice Decimal?
  costPrice    Decimal?
  stock        Int       @default(0)
  active       Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  product         Product                 @relation(fields: [productId], references: [id], onDelete: Cascade)
  attributeValues VariantAttributeValue[]
  images          VariantImage[]
  orderItems      OrderItem[]

  @@index([productId])
  @@index([storeId])
  @@map("product_variants")
}

model VariantAttributeValue {
  variantId        String
  attributeValueId String

  variant        ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  attributeValue AttributeValue @relation(fields: [attributeValueId], references: [id], onDelete: Restrict)

  @@id([variantId, attributeValueId])
  @@map("variant_attribute_values")
}

model VariantImage {
  id        String  @id @default(uuid())
  variantId String
  url       String
  alt       String?
  order     Int     @default(0)

  variant   ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)

  @@map("variant_images")
}
```

- [ ] **Step 4: Rodar a migration**

```bash
cd packages/database
npx prisma migrate dev --name add-product-variants
```

Saída esperada: `Your database is now in sync with your schema.`

- [ ] **Step 5: Regenerar o Prisma Client**

```bash
npx prisma generate
```

Saída esperada: `Generated Prisma Client`.

- [ ] **Step 6: Commit**

```bash
git add packages/database/schema.prisma packages/database/prisma/migrations/
git commit -m "feat: add product variants schema (ProductAttribute, AttributeValue, ProductVariant, VariantAttributeValue, VariantImage)"
```

---

## Task 2: Inventory Module — Backend

**Files:**
- Create: `apps/api/src/modules/inventory/inventory.module.ts`
- Create: `apps/api/src/modules/inventory/inventory.service.ts`
- Create: `apps/api/src/modules/inventory/inventory.controller.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Criar inventory.service.ts**

Criar `apps/api/src/modules/inventory/inventory.service.ts` com o conteúdo:

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../infra/database/prisma.service'

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProductOwnership(storeId: string, productId: string) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, storeId } })
    if (!product) throw new NotFoundException('Produto não encontrado')
    return product
  }

  private async ensureVariantOwnership(storeId: string, productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, productId, storeId },
    })
    if (!variant) throw new NotFoundException('Variante não encontrada')
    return variant
  }

  // ─── Atributos ────────────────────────────────────────────

  async getAttributes(storeId: string, productId: string) {
    await this.ensureProductOwnership(storeId, productId)
    return this.prisma.productAttribute.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
      include: { values: { orderBy: { position: 'asc' } } },
    })
  }

  async createAttribute(storeId: string, productId: string, data: { name: string; position?: number }) {
    await this.ensureProductOwnership(storeId, productId)
    return this.prisma.productAttribute.create({
      data: { productId, storeId, name: data.name, position: data.position ?? 0 },
      include: { values: true },
    })
  }

  async deleteAttribute(storeId: string, productId: string, attributeId: string) {
    await this.ensureProductOwnership(storeId, productId)
    const attr = await this.prisma.productAttribute.findFirst({
      where: { id: attributeId, productId },
      include: { values: { include: { variantValues: true } } },
    })
    if (!attr) throw new NotFoundException('Atributo não encontrado')
    const inUse = attr.values.some((v) => v.variantValues.length > 0)
    if (inUse) throw new BadRequestException('Remova as variantes que usam este atributo antes de excluí-lo')
    await this.prisma.productAttribute.delete({ where: { id: attributeId } })
  }

  async addAttributeValue(
    storeId: string,
    productId: string,
    attributeId: string,
    data: { value: string; position?: number },
  ) {
    await this.ensureProductOwnership(storeId, productId)
    const attr = await this.prisma.productAttribute.findFirst({ where: { id: attributeId, productId } })
    if (!attr) throw new NotFoundException('Atributo não encontrado')
    return this.prisma.attributeValue.create({
      data: { attributeId, value: data.value, position: data.position ?? 0 },
    })
  }

  async deleteAttributeValue(
    storeId: string,
    productId: string,
    attributeId: string,
    valueId: string,
  ) {
    await this.ensureProductOwnership(storeId, productId)
    const value = await this.prisma.attributeValue.findFirst({
      where: { id: valueId, attributeId },
      include: { variantValues: true },
    })
    if (!value) throw new NotFoundException('Valor não encontrado')
    if (value.variantValues.length > 0) {
      throw new BadRequestException('Remova as variantes que usam este valor antes de excluí-lo')
    }
    await this.prisma.attributeValue.delete({ where: { id: valueId } })
  }

  // ─── Variantes ────────────────────────────────────────────

  async getVariants(storeId: string, productId: string) {
    await this.ensureProductOwnership(storeId, productId)
    return this.prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
      include: {
        images: { orderBy: { order: 'asc' } },
        attributeValues: {
          include: { attributeValue: { include: { attribute: true } } },
        },
      },
    })
  }

  async createVariant(
    storeId: string,
    productId: string,
    data: {
      sku?: string
      price: number
      comparePrice?: number
      costPrice?: number
      stock?: number
      active?: boolean
      attributeValueIds: string[]
    },
  ) {
    await this.ensureProductOwnership(storeId, productId)
    return this.prisma.productVariant.create({
      data: {
        productId,
        storeId,
        sku: data.sku,
        price: data.price,
        comparePrice: data.comparePrice,
        costPrice: data.costPrice,
        stock: data.stock ?? 0,
        active: data.active ?? true,
        attributeValues: {
          create: data.attributeValueIds.map((id) => ({ attributeValueId: id })),
        },
      },
      include: {
        images: true,
        attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
      },
    })
  }

  async updateVariant(
    storeId: string,
    productId: string,
    variantId: string,
    data: { sku?: string; price?: number; comparePrice?: number; costPrice?: number; stock?: number; active?: boolean },
  ) {
    await this.ensureVariantOwnership(storeId, productId, variantId)
    return this.prisma.productVariant.update({
      where: { id: variantId },
      data,
      include: {
        images: true,
        attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
      },
    })
  }

  async deleteVariant(storeId: string, productId: string, variantId: string) {
    await this.ensureVariantOwnership(storeId, productId, variantId)
    const inOrders = await this.prisma.orderItem.count({ where: { variantId } })
    if (inOrders > 0) {
      // Soft delete — variante aparece em pedidos, não pode ser removida
      await this.prisma.productVariant.update({ where: { id: variantId }, data: { active: false } })
      return
    }
    await this.prisma.productVariant.delete({ where: { id: variantId } })
  }

  async generateVariants(storeId: string, productId: string) {
    const product = await this.ensureProductOwnership(storeId, productId)

    const attributes = await this.prisma.productAttribute.findMany({
      where: { productId },
      orderBy: { position: 'asc' },
      include: { values: { orderBy: { position: 'asc' } } },
    })

    if (attributes.length === 0) throw new BadRequestException('Crie ao menos um atributo antes de gerar variantes')
    if (attributes.some((a) => a.values.length === 0)) {
      throw new BadRequestException('Todos os atributos devem ter ao menos um valor')
    }

    const cartesian = (arrays: string[][]): string[][] =>
      arrays.reduce<string[][]>((acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])), [[]])

    const valueIdArrays = attributes.map((a) => a.values.map((v) => v.id))
    const combinations = cartesian(valueIdArrays)

    const existing = await this.prisma.productVariant.findMany({
      where: { productId },
      include: { attributeValues: true },
    })
    const existingKeys = new Set(
      existing.map((v) => v.attributeValues.map((av) => av.attributeValueId).sort().join(','))
    )

    const created: any[] = []
    for (const combo of combinations) {
      const key = [...combo].sort().join(',')
      if (existingKeys.has(key)) continue
      const variant = await this.prisma.productVariant.create({
        data: {
          productId,
          storeId,
          price: product.price,
          stock: 0,
          attributeValues: { create: combo.map((id) => ({ attributeValueId: id })) },
        },
        include: {
          attributeValues: { include: { attributeValue: { include: { attribute: true } } } },
        },
      })
      created.push(variant)
    }
    return created
  }

  // ─── Imagens de variante ──────────────────────────────────

  async getVariantImages(storeId: string, productId: string, variantId: string) {
    await this.ensureVariantOwnership(storeId, productId, variantId)
    return this.prisma.variantImage.findMany({
      where: { variantId },
      orderBy: { order: 'asc' },
    })
  }

  async addVariantImage(
    storeId: string,
    productId: string,
    variantId: string,
    data: { url: string; alt?: string },
  ) {
    await this.ensureVariantOwnership(storeId, productId, variantId)
    const count = await this.prisma.variantImage.count({ where: { variantId } })
    return this.prisma.variantImage.create({
      data: { variantId, url: data.url, alt: data.alt ?? null, order: count },
    })
  }

  async deleteVariantImage(
    storeId: string,
    productId: string,
    variantId: string,
    imageId: string,
  ) {
    await this.ensureVariantOwnership(storeId, productId, variantId)
    const image = await this.prisma.variantImage.findFirst({ where: { id: imageId, variantId } })
    if (!image) throw new NotFoundException('Imagem não encontrada')
    await this.prisma.variantImage.delete({ where: { id: imageId } })
  }
}
```

- [ ] **Step 2: Criar inventory.controller.ts**

Criar `apps/api/src/modules/inventory/inventory.controller.ts` com o conteúdo:

```typescript
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, UseGuards, HttpCode,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { InventoryService } from './inventory.service'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { StoreId } from '../../common/decorators/tenant.decorator'
import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsUUID } from 'class-validator'
import { Type } from 'class-transformer'

class CreateAttributeDto {
  @IsString() name: string
  @IsOptional() @IsNumber() @Type(() => Number) position?: number
}

class AddAttributeValueDto {
  @IsString() value: string
  @IsOptional() @IsNumber() @Type(() => Number) position?: number
}

class CreateVariantDto {
  @IsOptional() @IsString() sku?: string
  @IsNumber() @Type(() => Number) price: number
  @IsOptional() @IsNumber() @Type(() => Number) comparePrice?: number
  @IsOptional() @IsNumber() @Type(() => Number) costPrice?: number
  @IsOptional() @IsNumber() @Type(() => Number) stock?: number
  @IsOptional() @IsBoolean() active?: boolean
  @IsArray() @IsUUID('4', { each: true }) attributeValueIds: string[]
}

class UpdateVariantDto {
  @IsOptional() @IsString() sku?: string
  @IsOptional() @IsNumber() @Type(() => Number) price?: number
  @IsOptional() @IsNumber() @Type(() => Number) comparePrice?: number
  @IsOptional() @IsNumber() @Type(() => Number) costPrice?: number
  @IsOptional() @IsNumber() @Type(() => Number) stock?: number
  @IsOptional() @IsBoolean() active?: boolean
}

class AddVariantImageDto {
  @IsString() url: string
  @IsOptional() @IsString() alt?: string
}

@ApiTags('Inventory')
@Controller('products/:productId')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ─── Atributos ────────────────────────────────────────────

  @Get('attributes')
  getAttributes(@StoreId() storeId: string, @Param('productId') productId: string) {
    return this.inventoryService.getAttributes(storeId, productId)
  }

  @Post('attributes')
  createAttribute(
    @StoreId() storeId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateAttributeDto,
  ) {
    return this.inventoryService.createAttribute(storeId, productId, dto)
  }

  @Delete('attributes/:attributeId')
  @HttpCode(204)
  deleteAttribute(
    @StoreId() storeId: string,
    @Param('productId') productId: string,
    @Param('attributeId') attributeId: string,
  ) {
    return this.inventoryService.deleteAttribute(storeId, productId, attributeId)
  }

  @Post('attributes/:attributeId/values')
  addAttributeValue(
    @StoreId() storeId: string,
    @Param('productId') productId: string,
    @Param('attributeId') attributeId: string,
    @Body() dto: AddAttributeValueDto,
  ) {
    return this.inventoryService.addAttributeValue(storeId, productId, attributeId, dto)
  }

  @Delete('attributes/:attributeId/values/:valueId')
  @HttpCode(204)
  deleteAttributeValue(
    @StoreId() storeId: string,
    @Param('productId') productId: string,
    @Param('attributeId') attributeId: string,
    @Param('valueId') valueId: string,
  ) {
    return this.inventoryService.deleteAttributeValue(storeId, productId, attributeId, valueId)
  }

  // ─── Variantes ────────────────────────────────────────────

  @Get('variants')
  getVariants(@StoreId() storeId: string, @Param('productId') productId: string) {
    return this.inventoryService.getVariants(storeId, productId)
  }

  @Post('variants/generate')
  generateVariants(@StoreId() storeId: string, @Param('productId') productId: string) {
    return this.inventoryService.generateVariants(storeId, productId)
  }

  @Post('variants')
  createVariant(
    @StoreId() storeId: string,
    @Param('productId') productId: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.inventoryService.createVariant(storeId, productId, dto)
  }

  @Patch('variants/:variantId')
  updateVariant(
    @StoreId() storeId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.inventoryService.updateVariant(storeId, productId, variantId, dto)
  }

  @Delete('variants/:variantId')
  @HttpCode(204)
  deleteVariant(
    @StoreId() storeId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.inventoryService.deleteVariant(storeId, productId, variantId)
  }

  // ─── Imagens de variante ──────────────────────────────────

  @Get('variants/:variantId/images')
  getVariantImages(
    @StoreId() storeId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
  ) {
    return this.inventoryService.getVariantImages(storeId, productId, variantId)
  }

  @Post('variants/:variantId/images')
  addVariantImage(
    @StoreId() storeId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Body() dto: AddVariantImageDto,
  ) {
    return this.inventoryService.addVariantImage(storeId, productId, variantId, dto)
  }

  @Delete('variants/:variantId/images/:imageId')
  @HttpCode(204)
  deleteVariantImage(
    @StoreId() storeId: string,
    @Param('productId') productId: string,
    @Param('variantId') variantId: string,
    @Param('imageId') imageId: string,
  ) {
    return this.inventoryService.deleteVariantImage(storeId, productId, variantId, imageId)
  }
}
```

- [ ] **Step 3: Criar inventory.module.ts**

Criar `apps/api/src/modules/inventory/inventory.module.ts` com o conteúdo:

```typescript
import { Module } from '@nestjs/common'
import { InventoryController } from './inventory.controller'
import { InventoryService } from './inventory.service'

@Module({
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
```

- [ ] **Step 4: Registrar InventoryModule no AppModule**

Em `apps/api/src/app.module.ts`, adicionar o import e registrar no array `imports`:

```typescript
import { InventoryModule } from './modules/inventory/inventory.module'
```

No array `imports`, após `CouponsModule`, adicionar:
```typescript
    InventoryModule,
```

- [ ] **Step 5: Build para verificar erros de TypeScript**

```bash
cd apps/api
npx tsc --noEmit
```

Saída esperada: nenhum erro.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/inventory/ apps/api/src/app.module.ts
git commit -m "feat: add InventoryModule (attributes, variants, variant images endpoints)"
```

---

## Task 3: Atualizar products.service.ts — findBySlug + indexProduct

**Files:**
- Modify: `apps/api/src/modules/products/products.service.ts`

- [ ] **Step 1: Atualizar findBySlug para incluir atributos e variantes**

Substituir o método `findBySlug` completo:

```typescript
  async findBySlug(storeId: string, slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { storeId_slug: { storeId, slug } },
      include: {
        images: { orderBy: { order: 'asc' } },
        category: true,
        attributes: {
          orderBy: { position: 'asc' },
          include: { values: { orderBy: { position: 'asc' } } },
        },
        variants: {
          where: { active: true },
          orderBy: { createdAt: 'asc' },
          include: {
            images: { orderBy: { order: 'asc' } },
            attributeValues: {
              include: { attributeValue: { include: { attribute: true } } },
            },
          },
        },
      },
    })

    if (!product) throw new NotFoundException('Produto não encontrado')
    return product
  }
```

- [ ] **Step 2: Incluir variants nas queries de create, update e addImage**

No método `create`, substituir o bloco `include`:
```typescript
      include: {
        images: { take: 1, orderBy: { order: 'asc' } },
        category: { select: { name: true } },
        variants: { where: { active: true }, select: { price: true, stock: true } },
      },
```

No método `update`, substituir o bloco `include`:
```typescript
      include: {
        images: { take: 1, orderBy: { order: 'asc' } },
        category: { select: { name: true } },
        variants: { where: { active: true }, select: { price: true, stock: true } },
      },
```

No método `addImage`, na query que carrega o produto para re-indexar (dentro do `if (count === 0)`), substituir:
```typescript
        include: { images: { take: 1, orderBy: { order: 'asc' } }, category: { select: { name: true } }, variants: { where: { active: true }, select: { price: true, stock: true } } },
```

- [ ] **Step 3: Atualizar o método indexProduct para usar preço/estoque das variantes**

Substituir o método `indexProduct` completo:

```typescript
  private indexProduct(product: any) {
    const hasVariants = product.variants && product.variants.length > 0
    const price = hasVariants
      ? Math.min(...product.variants.map((v: any) => Number(v.price)))
      : Number(product.price)
    const stock = hasVariants
      ? product.variants.reduce((acc: number, v: any) => acc + v.stock, 0)
      : product.stock

    this.searchService?.indexProduct({
      id: product.id,
      storeId: product.storeId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price,
      comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
      stock,
      active: product.active,
      featured: product.featured,
      categoryId: product.categoryId,
      categoryName: product.category?.name ?? null,
      imageUrl: product.images?.[0]?.url ?? null,
      sku: product.sku,
    })
  }
```

- [ ] **Step 4: Build para verificar**

```bash
cd apps/api
npx tsc --noEmit
```

Saída esperada: nenhum erro.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/products/products.service.ts
git commit -m "feat: include variants in product findBySlug and variant-aware search indexing"
```

---

## Task 4: Atualizar checkout.service.ts — suporte a variantId

**Files:**
- Modify: `apps/api/src/modules/checkout/checkout.service.ts`

- [ ] **Step 1: Atualizar a interface CartItem para incluir variantId**

Substituir:
```typescript
export interface CartItem {
  productId: string
  quantity: number
}
```

Por:
```typescript
export interface CartItem {
  productId: string
  variantId?: string
  quantity: number
}
```

- [ ] **Step 2: Adicionar busca das variantes antes da validação de estoque**

Após a validação de que todos os produtos existem (após o `if (products.length !== dto.items.length)`), adicionar a busca batch de variantes e a detecção de quais produtos têm variantes ativas:

```typescript
    // Busca variantes necessárias (batch)
    const itemsWithVariant = dto.items.filter((i) => i.variantId)
    const variantMap = new Map<string, any>()
    if (itemsWithVariant.length > 0) {
      const fetched = await this.prisma.productVariant.findMany({
        where: {
          id: { in: itemsWithVariant.map((i) => i.variantId!) },
          storeId,
          active: true,
        },
      })
      fetched.forEach((v) => variantMap.set(v.id, v))
    }

    // Descobre quais produtos têm variantes ativas (para items sem variantId)
    const itemsWithoutVariant = dto.items.filter((i) => !i.variantId)
    const productsWithVariants = new Set<string>()
    if (itemsWithoutVariant.length > 0) {
      const pv = await this.prisma.productVariant.findMany({
        where: {
          productId: { in: itemsWithoutVariant.map((i) => i.productId) },
          storeId,
          active: true,
        },
        select: { productId: true },
        distinct: ['productId'],
      })
      pv.forEach((v) => productsWithVariants.add(v.productId))
    }
```

- [ ] **Step 3: Substituir o loop de validação de estoque**

Substituir o bloco de validação de estoque:

```typescript
    // Verifica estoque
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId)!
      if (item.variantId) {
        const variant = variantMap.get(item.variantId)
        if (!variant || variant.productId !== item.productId) {
          throw new BadRequestException(`Variante indisponível: ${product.name}`)
        }
        if (variant.stock < item.quantity) {
          throw new BadRequestException(`Estoque insuficiente: ${product.name}`)
        }
      } else {
        if (productsWithVariants.has(item.productId)) {
          throw new BadRequestException(`Selecione uma variante para: ${product.name}`)
        }
        if (product.stock < item.quantity) {
          throw new BadRequestException(`Estoque insuficiente: ${product.name}`)
        }
      }
    }
```

- [ ] **Step 4: Atualizar o cálculo do subtotal para usar preço da variante**

Substituir o cálculo do subtotal:

```typescript
    let subtotal = dto.items.reduce((acc, item) => {
      const product = products.find((p) => p.id === item.productId)!
      const price = item.variantId
        ? Number(variantMap.get(item.variantId)!.price)
        : Number(product.price)
      return acc + price * item.quantity
    }, 0)
```

- [ ] **Step 5: Atualizar a criação dos OrderItems para incluir variantId e preço correto**

Dentro do `order.create`, substituir o `items.create`:

```typescript
        items: {
          create: dto.items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!
            const variant = item.variantId ? variantMap.get(item.variantId) : null
            const price = variant ? Number(variant.price) : Number(product.price)
            return {
              productId: item.productId,
              variantId: item.variantId ?? null,
              name: product.name,
              price,
              quantity: item.quantity,
            }
          }),
        },
```

- [ ] **Step 6: Atualizar a deducão de estoque**

Substituir o bloco `// 5. Desconta estoque`:

```typescript
    // 5. Desconta estoque
    for (const item of dto.items) {
      if (item.variantId) {
        await this.prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        })
      } else {
        await this.prisma.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        })
      }
    }
```

- [ ] **Step 7: Build para verificar**

```bash
cd apps/api
npx tsc --noEmit
```

Saída esperada: nenhum erro.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/checkout/checkout.service.ts
git commit -m "feat: variant-aware stock validation and deduction in checkout"
```

---

## Task 5: Atualizar lib/api.ts e lib/cart.ts — variantId + api.patch

**Files:**
- Modify: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/cart.ts`

- [ ] **Step 1: Adicionar api.patch ao cliente HTTP**

Em `apps/web/lib/api.ts`, adicionar o método `patch` ao objeto `api` (após o método `put`):

```typescript
  patch: <T = any>(path: string, body: any, opts?: FetchOptions) =>
    apiClient<T>(path, { ...opts, method: 'PATCH', body: JSON.stringify(body) }),
```

- [ ] **Step 2: Atualizar a interface CartItem**

Em `apps/web/lib/cart.ts`, substituir a interface `CartItem`:

```typescript
export interface CartItem {
  productId: string
  variantId?: string | null
  name: string
  price: number
  imageUrl?: string
  quantity: number
}
```

- [ ] **Step 3: Atualizar a interface CartStore**

Substituir a interface `CartStore`:

```typescript
interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (productId: string, variantId?: string | null) => void
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void
  clear: () => void
  total: () => number
  count: () => number
}
```

- [ ] **Step 4: Atualizar as implementações do store**

Substituir toda a criação do store `useCart`:

```typescript
export const useCart = create<CartStore>((set, get) => ({
  items: [],

  addItem: (newItem) => {
    set((state) => {
      const existing = state.items.find(
        (i) => i.productId === newItem.productId && i.variantId === newItem.variantId,
      )
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productId === newItem.productId && i.variantId === newItem.variantId
              ? { ...i, quantity: i.quantity + newItem.quantity }
              : i,
          ),
        }
      }
      return { items: [...state.items, newItem] }
    })
  },

  removeItem: (productId, variantId) => {
    set((state) => ({
      items: state.items.filter(
        (i) => !(i.productId === productId && i.variantId === variantId),
      ),
    }))
  },

  updateQuantity: (productId, quantity, variantId) => {
    if (quantity <= 0) {
      get().removeItem(productId, variantId)
      return
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.productId === productId && i.variantId === variantId ? { ...i, quantity } : i,
      ),
    }))
  },

  clear: () => set({ items: [] }),

  total: () => get().items.reduce((acc, i) => acc + i.price * i.quantity, 0),

  count: () => get().items.reduce((acc, i) => acc + i.quantity, 0),
}))
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/api.ts apps/web/lib/cart.ts
git commit -m "feat: add variantId to cart store and api.patch helper"
```

---

## Task 6: Atualizar cart page e checkout page

**Files:**
- Modify: `apps/web/app/(storefront)/cart/page.tsx`
- Modify: `apps/web/app/(storefront)/checkout/page.tsx`

- [ ] **Step 1: Atualizar cart/page.tsx — chave única e chamadas com variantId**

Em `apps/web/app/(storefront)/cart/page.tsx`, fazer as três substituições:

**Linha 26 — chave do item:**
Substituir:
```tsx
          <div key={item.productId} className="flex gap-4 items-center p-4 border rounded-xl">
```
Por:
```tsx
          <div key={`${item.productId}:${item.variantId ?? ''}`} className="flex gap-4 items-center p-4 border rounded-xl">
```

**Linha 45 — decrementar quantidade:**
Substituir:
```tsx
                onClick={() => updateQuantity(item.productId, item.quantity - 1)}
```
Por:
```tsx
                onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)}
```

**Linha 50 — incrementar quantidade:**
Substituir:
```tsx
                onClick={() => updateQuantity(item.productId, item.quantity + 1)}
```
Por:
```tsx
                onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)}
```

**Linha 54 — remover item:**
Substituir:
```tsx
            <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
```
Por:
```tsx
            <button onClick={() => removeItem(item.productId, item.variantId)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
```

- [ ] **Step 2: Atualizar checkout/page.tsx — incluir variantId no payload**

Em `apps/web/app/(storefront)/checkout/page.tsx`, substituir o mapeamento de itens (linha 89):

```typescript
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId ?? undefined,
          quantity: i.quantity,
        })),
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/(storefront)/cart/page.tsx apps/web/app/(storefront)/checkout/page.tsx
git commit -m "feat: pass variantId in cart interactions and checkout payload"
```

---

## Task 7: Atualizar storefront — página do produto com seletores de variante

**Files:**
- Modify: `apps/web/app/(storefront)/product/[slug]/page.tsx`

- [ ] **Step 1: Substituir o arquivo completo**

Substituir `apps/web/app/(storefront)/product/[slug]/page.tsx` pelo conteúdo abaixo:

```tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useCart } from '../../../../lib/cart'
import { api } from '../../../../lib/api'
import Image from 'next/image'

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const [product, setProduct] = useState<any>(null)
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>({})
  const addItem = useCart((s) => s.addItem)

  useEffect(() => {
    api.get(`/products/${slug}`).then(setProduct).catch(console.error)
  }, [slug])

  const hasVariants = Boolean(product?.attributes?.length)

  const selectedVariant = useMemo(() => {
    if (!hasVariants || !product?.variants?.length) return null
    if (Object.keys(selectedValues).length < product.attributes.length) return null
    return (
      product.variants.find((v: any) =>
        v.attributeValues.every(
          (vav: any) => selectedValues[vav.attributeValue.attributeId] === vav.attributeValueId,
        ),
      ) ?? null
    )
  }, [product, selectedValues, hasVariants])

  const displayPrice = useMemo(() => {
    if (selectedVariant) return Number(selectedVariant.price)
    if (hasVariants && product?.variants?.length)
      return Math.min(...product.variants.map((v: any) => Number(v.price)))
    return product ? Number(product.price) : 0
  }, [product, selectedVariant, hasVariants])

  const displayStock = selectedVariant ? selectedVariant.stock : (product?.stock ?? 0)

  const displayImages: any[] =
    selectedVariant?.images?.length ? selectedVariant.images : (product?.images ?? [])

  const image = displayImages[0]?.url

  const allSelected = !hasVariants || Object.keys(selectedValues).length === product?.attributes?.length
  const canAdd = allSelected && displayStock > 0

  function handleAddToCart() {
    if (!product || !canAdd) return
    const variantLabel = selectedVariant
      ? ` (${selectedVariant.attributeValues.map((vav: any) => vav.attributeValue.value).join(' / ')})`
      : ''
    addItem({
      productId: product.id,
      variantId: selectedVariant?.id ?? null,
      name: product.name + variantLabel,
      price: displayPrice,
      imageUrl: image,
      quantity: qty,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (!product) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-400">Carregando...</div>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 grid md:grid-cols-2 gap-10">
      {/* Imagem */}
      <div className="bg-gray-100 rounded-2xl overflow-hidden aspect-square relative">
        {image ? (
          <Image src={image} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl">📦</div>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-4">
        {product.category && (
          <span className="text-sm text-gray-500 uppercase tracking-wide">{product.category.name}</span>
        )}
        <h1 className="text-3xl font-bold">{product.name}</h1>

        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold text-green-600">
            {hasVariants && !selectedVariant && (
              <span className="text-base font-normal text-gray-500 mr-1">A partir de</span>
            )}
            {displayPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          {!hasVariants && product.comparePrice && (
            <span className="text-lg text-gray-400 line-through">
              {Number(product.comparePrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          )}
        </div>

        {product.description && (
          <p className="text-gray-600 leading-relaxed">{product.description}</p>
        )}

        {/* Seletores de variante */}
        {hasVariants &&
          product.attributes.map((attr: any) => (
            <div key={attr.id}>
              <p className="text-sm font-medium mb-2">{attr.name}</p>
              <div className="flex flex-wrap gap-2">
                {attr.values.map((val: any) => {
                  const isSelected = selectedValues[attr.id] === val.id
                  const hasStock = product.variants.some(
                    (v: any) =>
                      v.attributeValues.some((vav: any) => vav.attributeValueId === val.id) &&
                      v.stock > 0,
                  )
                  return (
                    <button
                      key={val.id}
                      disabled={!hasStock}
                      onClick={() =>
                        setSelectedValues((prev) => ({ ...prev, [attr.id]: val.id }))
                      }
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition
                        ${isSelected ? 'border-black bg-black text-white' : 'border-gray-300 hover:border-gray-500'}
                        ${!hasStock ? 'opacity-40 cursor-not-allowed line-through' : ''}`}
                    >
                      {val.value}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

        <div className="flex items-center gap-3 mt-2">
          <label className="font-medium text-sm">Quantidade:</label>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200"
              onClick={() => setQty(Math.max(1, qty - 1))}
            >
              −
            </button>
            <span className="px-4 py-2 font-medium">{qty}</span>
            <button
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200"
              onClick={() => setQty(qty + 1)}
            >
              +
            </button>
          </div>
        </div>

        <button
          onClick={handleAddToCart}
          disabled={!canAdd}
          className="mt-4 py-3 px-6 rounded-xl text-white font-semibold text-lg transition
            bg-black hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {displayStock === 0
            ? 'Sem estoque'
            : !allSelected
              ? 'Selecione as opções'
              : added
                ? '✓ Adicionado!'
                : 'Adicionar ao carrinho'}
        </button>

        <p className="text-sm text-gray-400">
          {displayStock > 0 ? `${displayStock} em estoque` : 'Produto esgotado'}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/(storefront)/product/
git commit -m "feat: add variant selectors to product page storefront"
```

---

## Task 8: Atualizar admin — aba Variantes na página de produtos

**Files:**
- Modify: `apps/web/app/(admin)/admin/products/page.tsx`

- [ ] **Step 1: Adicionar interfaces de variante e atributo**

No topo do arquivo, após a interface `Category`, adicionar:

```typescript
interface AttributeValue {
  id: string
  value: string
  position: number
}

interface ProductAttribute {
  id: string
  name: string
  position: number
  values: AttributeValue[]
}

interface VariantAttributeValue {
  attributeValueId: string
  attributeValue: { id: string; value: string; attributeId: string; attribute: { id: string; name: string } }
}

interface ProductVariant {
  id: string
  sku?: string | null
  price: string | number
  comparePrice?: string | number | null
  stock: number
  active: boolean
  attributeValues: VariantAttributeValue[]
  images?: ProductImage[]
}
```

- [ ] **Step 2: Adicionar variáveis de estado para variants tab**

Logo após as variáveis de estado do image manager (após `const fileRef = ...`), adicionar:

```typescript
  // Variants tab
  const [variantTab, setVariantTab] = useState<'info' | 'variants'>('info')
  const [attributes, setAttributes] = useState<ProductAttribute[]>([])
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [newAttrName, setNewAttrName] = useState('')
  const [newValueInputs, setNewValueInputs] = useState<Record<string, string>>({})
  const [variantEdits, setVariantEdits] = useState<Record<string, Partial<ProductVariant>>>({})
  const [savingVariant, setSavingVariant] = useState<string | null>(null)
```

- [ ] **Step 3: Adicionar função loadVariantsData**

Após a função `load`, adicionar:

```typescript
  async function loadVariantsData(productId: string) {
    const token = localStorage.getItem('admin_token') ?? ''
    try {
      const [attrs, vars] = await Promise.all([
        api.get<ProductAttribute[]>(`/products/${productId}/attributes`, { token }),
        api.get<ProductVariant[]>(`/products/${productId}/variants`, { token }),
      ])
      setAttributes(Array.isArray(attrs) ? attrs : [])
      setVariants(Array.isArray(vars) ? vars : [])
    } catch { /* ignore */ }
  }
```

- [ ] **Step 4: Chamar loadVariantsData ao abrir edição**

Na função `openEdit`, após `setShowForm(true)`, adicionar:

```typescript
    setVariantTab('info')
    loadVariantsData(p.id)
```

- [ ] **Step 5: Adicionar funções de gerenciamento de atributos e variantes**

Após a função `toggleActive`, adicionar:

```typescript
  // ─── Attributes ───────────────────────────────────────────────────────────
  async function addAttribute() {
    if (!newAttrName.trim() || !editId) return
    const token = localStorage.getItem('admin_token') ?? ''
    try {
      await api.post(`/products/${editId}/attributes`, { name: newAttrName.trim() }, { token })
      setNewAttrName('')
      await loadVariantsData(editId)
    } catch (e: any) { alert(e.message) }
  }

  async function deleteAttribute(attrId: string) {
    if (!editId || !confirm('Remover atributo e todos os seus valores?')) return
    const token = localStorage.getItem('admin_token') ?? ''
    try {
      await api.delete(`/products/${editId}/attributes/${attrId}`, { token })
      await loadVariantsData(editId)
    } catch (e: any) { alert(e.message) }
  }

  async function addValue(attrId: string) {
    const val = newValueInputs[attrId]?.trim()
    if (!val || !editId) return
    const token = localStorage.getItem('admin_token') ?? ''
    try {
      await api.post(`/products/${editId}/attributes/${attrId}/values`, { value: val }, { token })
      setNewValueInputs((prev) => ({ ...prev, [attrId]: '' }))
      await loadVariantsData(editId)
    } catch (e: any) { alert(e.message) }
  }

  async function deleteValue(attrId: string, valueId: string) {
    if (!editId) return
    const token = localStorage.getItem('admin_token') ?? ''
    try {
      await api.delete(`/products/${editId}/attributes/${attrId}/values/${valueId}`, { token })
      await loadVariantsData(editId)
    } catch (e: any) { alert(e.message) }
  }

  // ─── Variants ─────────────────────────────────────────────────────────────
  async function generateVariants() {
    if (!editId || !confirm('Gerar todas as combinações? Variantes existentes não serão duplicadas.')) return
    const token = localStorage.getItem('admin_token') ?? ''
    try {
      await api.post(`/products/${editId}/variants/generate`, {}, { token })
      await loadVariantsData(editId)
    } catch (e: any) { alert(e.message) }
  }

  async function saveVariantEdit(variantId: string) {
    if (!editId) return
    const token = localStorage.getItem('admin_token') ?? ''
    setSavingVariant(variantId)
    try {
      await api.patch(`/products/${editId}/variants/${variantId}`, variantEdits[variantId] ?? {}, { token })
      setVariantEdits((prev) => { const n = { ...prev }; delete n[variantId]; return n })
      await loadVariantsData(editId)
    } catch (e: any) { alert(e.message) }
    finally { setSavingVariant(null) }
  }

  async function toggleVariantActive(v: ProductVariant) {
    if (!editId) return
    const token = localStorage.getItem('admin_token') ?? ''
    try {
      await api.patch(`/products/${editId}/variants/${v.id}`, { active: !v.active }, { token })
      await loadVariantsData(editId)
    } catch (e: any) { alert(e.message) }
  }
```

- [ ] **Step 6: Adicionar tabs e aba de Variantes ao formulário**

No JSX do formulário (`{showForm && (...`), logo após a linha `<h2 className="font-semibold mb-4">...</h2>`, adicionar os tabs (somente quando em edição):

```tsx
          {/* Tabs — apenas na edição */}
          {editId && (
            <div className="flex gap-1 mb-5 border-b">
              {(['info', 'variants'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setVariantTab(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition
                    ${variantTab === t ? 'border-black text-black' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                >
                  {t === 'info' ? 'Informações' : 'Variantes'}
                </button>
              ))}
            </div>
          )}
```

Em seguida, envolver o grid de campos existente com `{(!editId || variantTab === 'info') && (...)}`:

```tsx
          {(!editId || variantTab === 'info') && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ... todos os campos existentes do formulário ... */}
            </div>
          )}
```

E adicionar, após esse bloco, a aba de Variantes:

```tsx
          {/* Aba Variantes */}
          {editId && variantTab === 'variants' && (
            <div className="space-y-6">

              {/* Seção Atributos */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Atributos</h3>
                {attributes.length === 0 && (
                  <p className="text-sm text-gray-400 mb-3">Nenhum atributo cadastrado.</p>
                )}
                <div className="space-y-3">
                  {attributes.map((attr) => (
                    <div key={attr.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">{attr.name}</span>
                        <button onClick={() => deleteAttribute(attr.id)}
                          className="text-xs text-red-400 hover:text-red-600">Remover</button>
                      </div>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {attr.values.map((v) => (
                          <span key={v.id}
                            className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                            {v.value}
                            <button onClick={() => deleteValue(attr.id, v.id)}
                              className="text-gray-400 hover:text-red-500 leading-none">&times;</button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          className="border rounded px-2 py-1 text-xs flex-1 focus:outline-none focus:ring-1 focus:ring-black"
                          placeholder="+ novo valor"
                          value={newValueInputs[attr.id] ?? ''}
                          onChange={(e) => setNewValueInputs((prev) => ({ ...prev, [attr.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addValue(attr.id)}
                        />
                        <button onClick={() => addValue(attr.id)}
                          className="text-xs border px-2 py-1 rounded hover:bg-gray-50">Adicionar</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <input
                    className="border rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-black"
                    placeholder="Nome do atributo (ex: Tamanho)"
                    value={newAttrName}
                    onChange={(e) => setNewAttrName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addAttribute()}
                  />
                  <button onClick={addAttribute}
                    className="bg-black text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-800">
                    + Atributo
                  </button>
                </div>
              </div>

              {/* Gerar combinações */}
              {attributes.length > 0 && (
                <div>
                  <button onClick={generateVariants}
                    className="border border-dashed border-gray-400 text-gray-600 px-4 py-2 rounded-lg text-sm hover:border-black hover:text-black transition">
                    Gerar todas as combinações
                  </button>
                  <p className="text-xs text-gray-400 mt-1">Variantes existentes não serão duplicadas.</p>
                </div>
              )}

              {/* Tabela de variantes */}
              {variants.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Variantes ({variants.length})
                  </h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {['Atributos', 'SKU', 'Preço', 'Estoque', 'Ativo', ''].map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-gray-500 uppercase tracking-wide">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {variants.map((v) => {
                          const edit = variantEdits[v.id] ?? {}
                          const label = v.attributeValues
                            .map((vav) => vav.attributeValue.value)
                            .join(' / ')
                          return (
                            <tr key={v.id} className="border-t hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium">{label || '—'}</td>
                              <td className="px-3 py-2">
                                <input
                                  className="border rounded px-2 py-1 w-24 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                                  placeholder="SKU"
                                  defaultValue={v.sku ?? ''}
                                  onChange={(e) =>
                                    setVariantEdits((prev) => ({
                                      ...prev,
                                      [v.id]: { ...(prev[v.id] ?? {}), sku: e.target.value },
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number" step="0.01" min="0"
                                  className="border rounded px-2 py-1 w-24 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                                  defaultValue={Number(v.price)}
                                  onChange={(e) =>
                                    setVariantEdits((prev) => ({
                                      ...prev,
                                      [v.id]: { ...(prev[v.id] ?? {}), price: Number(e.target.value) },
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number" min="0"
                                  className="border rounded px-2 py-1 w-20 text-xs focus:outline-none focus:ring-1 focus:ring-black"
                                  defaultValue={v.stock}
                                  onChange={(e) =>
                                    setVariantEdits((prev) => ({
                                      ...prev,
                                      [v.id]: { ...(prev[v.id] ?? {}), stock: Number(e.target.value) },
                                    }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => toggleVariantActive(v)}
                                  className={`px-2 py-1 rounded-full text-xs font-medium transition
                                    ${v.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                                >
                                  {v.active ? 'Ativo' : 'Inativo'}
                                </button>
                              </td>
                              <td className="px-3 py-2">
                                {variantEdits[v.id] && (
                                  <button
                                    onClick={() => saveVariantEdit(v.id)}
                                    disabled={savingVariant === v.id}
                                    className="text-xs bg-black text-white px-2 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
                                  >
                                    {savingVariant === v.id ? '...' : 'Salvar'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
```

- [ ] **Step 7: Build TypeScript para verificar erros**

```bash
cd apps/web
npx tsc --noEmit
```

Saída esperada: nenhum erro.

- [ ] **Step 8: Commit**

```bash
git add apps/web/app/(admin)/admin/products/page.tsx
git commit -m "feat: add Variants tab to admin product form (attributes, generate, inline edit)"
```
