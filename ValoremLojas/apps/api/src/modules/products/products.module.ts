import { Module } from '@nestjs/common'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'
import { SearchModule } from '../search/search.module'
import { MediaModule } from '../media/media.module'

@Module({
  imports: [SearchModule, MediaModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
