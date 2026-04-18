import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/public.decorator';

@ApiTags('Readiness')
@Controller('ops')
export class ReadinessController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('healthz')
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Returns a lightweight liveness payload showing the API process is up.',
  })
  @ApiOkResponse({
    description: 'API liveness payload',
  })
  getHealthz() {
    return {
      ok: true,
      service: 'valises-backend',
      environment: process.env.NODE_ENV ?? 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('readyz')
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Returns readiness information after checking critical dependencies such as the database.',
  })
  @ApiOkResponse({
    description: 'API readiness payload',
  })
  async getReadyz() {
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');

      return {
        ok: true,
        service: 'valises-backend',
        dependencies: {
          database: 'up',
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'READINESS_FAILED',
        message: 'Readiness check failed',
        dependencies: {
          database: 'down',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }
}