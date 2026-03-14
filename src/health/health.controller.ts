import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description:
      'Public endpoint used to verify API availability and basic database readiness.',
  })
  @ApiOkResponse({
    description: 'Service health status',
    schema: {
      example: {
        ok: true,
        service: 'valises-backend',
        timestamp: '2026-03-14T10:00:00.000Z',
        checks: {
          api: 'up',
          database: 'up',
        },
      },
    },
  })
  async ok() {
    return this.healthService.getStatus();
  }
}