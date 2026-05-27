import { Controller, Post, Delete, Body, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { DeviceTokenService } from './device-token.service';

class RegisterDeviceDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty({ enum: ['IOS', 'ANDROID'] })
  @IsEnum(['IOS', 'ANDROID'])
  platform: 'IOS' | 'ANDROID';
}

class UnregisterDeviceDto {
  @ApiProperty()
  @IsString()
  token: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Roles('USER', 'ADMIN')
@Controller('notifications')
export class DeviceTokenController {
  constructor(private readonly deviceTokenService: DeviceTokenService) {}

  @Post('register-device')
  @ApiOperation({ summary: 'Register a device push token (idempotent)' })
  async registerDevice(@Body() dto: RegisterDeviceDto, @Req() req: any) {
    await this.deviceTokenService.registerToken(
      req.user.userId,
      dto.token,
      dto.platform,
    );
    return { registered: true };
  }

  @Delete('unregister-device')
  @ApiOperation({ summary: 'Unregister a specific device push token' })
  async unregisterDevice(@Body() dto: UnregisterDeviceDto, @Req() req: any) {
    await this.deviceTokenService.unregisterToken(req.user.userId, dto.token);
    return { unregistered: true };
  }
}
