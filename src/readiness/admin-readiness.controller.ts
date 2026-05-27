import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { ReadinessService } from './readiness.service';

@ApiTags('admin-readiness')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/readiness')
export class AdminReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get()
  @ApiOperation({
    summary: 'Alpha readiness report',
    description:
      'Returns overall READY/NOT_READY status with detailed per-check results. All checks are non-blocking — WARN does not fail overall readiness.',
  })
  async getReadiness() {
    return this.readinessService.getReadinessReport();
  }
}
