import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Body,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CorridorAdminService, PricingUpdateDto } from './corridor-admin.service';
import { UpdateCorridorLimitsDto } from './dto/corridor-limits.dto';

@ApiTags('admin-corridors')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/corridors')
export class CorridorAdminController {
  constructor(private readonly corridorAdminService: CorridorAdminService) {}

  @Get()
  @ApiOperation({ summary: 'List all corridors with current status and pricing' })
  async list() {
    return this.corridorAdminService.listCorridors();
  }

  @Patch(':code/status')
  @ApiOperation({ summary: 'Activate or deactivate a corridor' })
  async updateStatus(
    @Param('code') code: string,
    @Body() body: { isActive: boolean },
    @Req() req: any,
  ) {
    return this.corridorAdminService.updateStatus(code, body.isActive, req.user.userId);
  }

  @Patch(':code/pricing')
  @ApiOperation({ summary: 'Update corridor pricing (snapshots previous values)' })
  async updatePricing(
    @Param('code') code: string,
    @Body() dto: PricingUpdateDto,
    @Req() req: any,
  ) {
    return this.corridorAdminService.updatePricing(code, dto, req.user.userId);
  }

  @Post(':code/pricing/preview')
  @ApiOperation({ summary: 'Preview pricing change without saving' })
  async previewPricing(@Param('code') code: string, @Body() dto: PricingUpdateDto) {
    return this.corridorAdminService.previewPricing(code, dto);
  }

  @Post(':code/limits')
  @ApiOperation({ summary: 'Set weight and volume limits for a corridor' })
  async updateCorridorLimits(
    @Param('code') code: string,
    @Body() dto: UpdateCorridorLimitsDto,
    @Req() req: any,
  ) {
    return this.corridorAdminService.updateCorridorLimits(code, req.user.userId, dto);
  }
}
