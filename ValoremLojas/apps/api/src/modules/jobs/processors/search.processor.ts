import { Processor, Process, OnQueueFailed } from '@nestjs/bull'
import { Logger } from '@nestjs/common'
import { Job } from 'bull'
import { MeiliSearch } from 'meilisearch'
import {
  QUEUE_SEARCH,
  JOB_SEARCH_INDEX_PRODUCT,
  JOB_SEARCH_DELETE_PRODUCT,
  JOB_SEARCH_REINDEX_STORE,
} from '../jobs.constants'
import type { ProductDocument } from '../../search/search.service'

const INDEX_NAME = 'products'

@Processor(QUEUE_SEARCH)
export class SearchIndexProcessor {
  private readonly logger = new Logger(SearchIndexProcessor.name)
  private readonly meili: MeiliSearch | null = null

  constructor() {
    const host = process.env.MEILI_HOST
    const apiKey = process.env.MEILI_MASTER_KEY
    if (host) {
      this.meili = new MeiliSearch({ host, apiKey })
    }
  }

  @Process(JOB_SEARCH_INDEX_PRODUCT)
  async handleIndexProduct(job: Job<ProductDocument>) {
    if (!this.meili) return
    await this.meili.index(INDEX_NAME).addDocuments([job.data])
    this.logger.debug(`Produto indexado: ${job.data.id}`)
  }

  @Process(JOB_SEARCH_DELETE_PRODUCT)
  async handleDeleteProduct(job: Job<{ id: string }>) {
    if (!this.meili) return
    await this.meili.index(INDEX_NAME).deleteDocument(job.data.id)
    this.logger.debug(`Produto removido do índice: ${job.data.id}`)
  }

  @Process(JOB_SEARCH_REINDEX_STORE)
  async handleReindexStore(job: Job<{ storeId: string; products: ProductDocument[] }>) {
    if (!this.meili) return
    const { storeId, products } = job.data

    // Remove todos os documentos da loja antes de reinserir
    await this.meili
      .index(INDEX_NAME)
      .deleteDocuments({ filter: `storeId = "${storeId}"` })
      .catch(() => {}) // graceful: índice pode não ter filtro configurado ainda

    if (products.length > 0) {
      await this.meili.index(INDEX_NAME).addDocuments(products)
    }

    this.logger.log(`Reindex concluído para storeId=${storeId}: ${products.length} produtos`)
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.warn(`Job ${job.name} falhou (tentativa ${job.attemptsMade}): ${error.message}`)
  }
}
