import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FraudService } from './fraud.service';

@ApiTags('Fraud')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fraud')
export class FraudController {
  constructor(private readonly fraudService: FraudService) {}

  @Get('flags/user/:userId')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get active fraud flags for a user (admin only)' })
  @ApiParam({ name: 'userId', type: String })
  async getActiveFlags(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.fraudService.getActiveFlags(userId);
  }

  @Patch('flags/:id/resolve')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Resolve a fraud flag (admin only)' })
  @ApiParam({ name: 'id', type: String })
  async resolveFlag(@Param('id', ParseUUIDPipe) id: string) {
    try {
      return await this.fraudService.resolveFlag(id);
    } catch {
      throw new NotFoundException(`Fraud flag ${id} not found`);
    }
  }
}
