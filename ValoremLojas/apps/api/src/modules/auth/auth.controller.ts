import { Controller, Post, Body, Request } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AuthService } from './auth.service'
import { IsEmail, IsString, MinLength } from 'class-validator'

class LoginDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(6)
  password: string
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Request() req: any) {
    const storeId = req.storeId
    return this.authService.login(dto.email, dto.password, storeId)
  }
}
