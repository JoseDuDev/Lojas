import { Global, Module } from '@nestjs/common'
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager'
import { redisStore } from 'cache-manager-ioredis-yet'

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
        }),
        ttl: 60 * 5, // 5 minutos padrão
      }),
    }),
  ],
})
export class CacheModule {}
