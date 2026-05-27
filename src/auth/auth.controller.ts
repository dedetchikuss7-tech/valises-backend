import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { Public } from './public.decorator';
import { DeviceTokenService } from '../push/device-token.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly deviceTokenService: DeviceTokenService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register')
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a new public user account with USER role and returns the created user profile.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'User registered successfully.',
    schema: {
      example: {
        id: '9f1c3b67-2f6c-4c46-8d1c-5f4f52a2f001',
        email: 'user@example.com',
        role: 'USER',
        kycStatus: 'NOT_STARTED',
        createdAt: '2026-03-14T12:00:00.000Z',
        updatedAt: '2026-03-14T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or email already registered.',
  })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login and get JWT access token',
    description: 'Authenticates a user with email and password and returns a JWT access token.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Authentication successful.',
    schema: {
      example: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          id: '9f1c3b67-2f6c-4c46-8d1c-5f4f52a2f001',
          email: 'user@example.com',
          role: 'USER',
          kycStatus: 'NOT_STARTED',
        },
      },
    },
  })
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and unregister all device push tokens' })
  @ApiOkResponse({ description: 'Logged out successfully.' })
  async logout(@Req() req: any) {
    await this.deviceTokenService.unregisterAllForUser(req.user.userId);
    return { loggedOut: true };
  }
}
