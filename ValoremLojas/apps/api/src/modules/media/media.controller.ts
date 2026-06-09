import { Controller, Post, Delete, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { IsString, IsOptional } from 'class-validator'
import { MediaService } from './media.service'
import { JwtAuthGuard } from '../../common/guards/jwt.guard'
import { StoreId } from '../../common/decorators/tenant.decorator'

class GenerateUploadUrlDto {
  @IsString() fileName: string
  @IsString() contentType: string
  @IsOptional() @IsString() folder?: string
}

class DeleteFileDto {
  @IsString() key: string
}

@ApiTags('Media')
@Controller('media')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  // Gera URL assinada para upload direto ao S3/R2 pelo frontend
  @Post('upload-url')
  generateUploadUrl(
    @StoreId() storeId: string,
    @Body() dto: GenerateUploadUrlDto,
  ) {
    return this.mediaService.generateUploadUrl(
      storeId,
      dto.folder || 'products',
      dto.fileName,
      dto.contentType,
    )
  }

  // Remove arquivo do storage
  @Delete()
  deleteFile(@Body() dto: DeleteFileDto) {
    return this.mediaService.deleteFile(dto.key)
  }
}
