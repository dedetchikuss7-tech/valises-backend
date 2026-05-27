import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { OperationalHealthService } from './operational-health.service';

@ApiTags('Admin — Operational Health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/operational-health')
export class OperationalHealthController {
  constructor(private readonly service: OperationalHealthService) {}

  @Get()
  @ApiOperation({ summary: 'Get operational health snapshot' })
  async getSnapshot() {
    return this.service.getHealthSnapshot();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Pre-aggregated operational metrics — fixed time windows, no live scans' })
  async getMetrics() {
    return this.service.getMetrics();
  }
}
