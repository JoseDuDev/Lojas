import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { MeiliSearch } from 'meilisearch'
import {
  QUEUE_SEARCH,
  JOB_SEARCH_INDEX_PRODUCT,
  JOB_SEARCH_DELETE_PRODUCT,
  JOB_SEARCH_REINDEX_STORE,
  JOB_DEFAULT_OPTS,
} from '../jobs/jobs.constants'

export interface ProductDocument {
  id: string
  storeId: string
  name: string
  slug: string
  description?: string | null
  price: number
  comparePrice?: number | null
  stock: number
  active: boolean
  featured: boolean
  categoryId?: string | null
  categoryName?: string | null
  imageUrl?: string | null
  sku?: string | null
}

const INDEX = 'products'

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name)
  private readonly client: MeiliSearch

  constructor(
    @InjectQueue(QUEUE_SEARCH) private readonly searchQueue: Queue,
  ) {
    this.client = new MeiliSearch({
      host: process.env.MEILI_HOST || 'http://localhost:7700',
      apiKey: process.env.MEILI_MASTER_KEY || 'masterKey123',
    })
  }

  async onModuleInit() {
    try {
      await this.client.index(INDEX).updateSettings({
        searchableAttributes: ['name', 'description', 'sku', 'categoryName'],
        filterableAttributes: ['storeId', 'active', 'featured', 'categoryId', 'price'],
        sortableAttributes: ['price', 'stock'],
        rankingRules: ['typo', 'words', 'proximity', 'attribute', 'sort', 'exactness'],
      })
      this.logger.log('Meilisearch configurado com sucesso')
    } catch (e: any) {
      this.logger.warn(`Meilisearch indisponível no startup: ${e.message}`)
    }
  }

  // Enfileira indexação de um produto (chamado no create/update)
  async indexProduct(product: ProductDocument) {
    try {
      await this.searchQueue.add(JOB_SEARCH_INDEX_PRODUCT, product, JOB_DEFAULT_OPTS)
    } catch (e: any) {
      this.logger.warn(`Falha ao enfileirar indexação do produto ${product.id}: ${e.message}`)
    }
  }

  // Enfileira remoção de um produto do índice (chamado no remove)
  async deleteProduct(productId: string) {
    try {
      await this.searchQueue.add(JOB_SEARCH_DELETE_PRODUCT, { id: productId }, JOB_DEFAULT_OPTS)
    } catch (e: any) {
      this.logger.warn(`Falha ao enfileirar remoção do produto ${productId}: ${e.message}`)
    }
  }

  // Enfileira reindex completo de uma loja (chamado pelo admin)
  async reindexStore(storeId: string, products: ProductDocument[]) {
    try {
      await this.searchQueue.add(
        JOB_SEARCH_REINDEX_STORE,
        { storeId, products },
        { ...JOB_DEFAULT_OPTS, attempts: 2 },
      )
      this.logger.log(`Reindex enfileirado: ${products.length} produtos da loja ${storeId}`)
      return { queued: products.length }
    } catch (e: any) {
      this.logger.warn(`Falha ao enfileirar reindex da loja ${storeId}: ${e.message}`)
      throw e
    }
  }

  // Busca síncrona — retorna imediatamente, não usa fila
  async search(
    storeId: string,
    query: string,
    options?: {
      categoryId?: string
      minPrice?: number
      maxPrice?: number
      featured?: boolean
      limit?: number
      offset?: number
      sortBy?: 'price:asc' | 'price:desc'
    },
  ) {
    try {
      const filters: string[] = [`storeId = "${storeId}"`, 'active = true']
      if (options?.categoryId) filters.push(`categoryId = "${options.categoryId}"`)
      if (options?.featured) filters.push('featured = true')
      if (options?.minPrice !== undefined) filters.push(`price >= ${options.minPrice}`)
      if (options?.maxPrice !== undefined) filters.push(`price <= ${options.maxPrice}`)

      const result = await this.client.index(INDEX).search(query, {
        filter: filters.join(' AND '),
        limit: options?.limit ?? 20,
        offset: options?.offset ?? 0,
        sort: options?.sortBy ? [options.sortBy] : undefined,
        attributesToHighlight: ['name', 'description'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
      })

      return {
        hits: result.hits,
        total: result.estimatedTotalHits ?? result.hits.length,
        query,
        processingTimeMs: result.processingTimeMs,
      }
    } catch (e: any) {
      this.logger.warn(`Falha na busca "${query}": ${e.message}`)
      return { hits: [], total: 0, query, processingTimeMs: 0 }
    }
  }
}
