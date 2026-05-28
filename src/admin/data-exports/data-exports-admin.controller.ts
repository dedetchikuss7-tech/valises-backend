import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../../auth/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('admin-data-exports')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/data-exports')
export class DataExportsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('pending')
  @ApiOperation({ summary: 'List pending and processing data export requests' })
  async getPendingExports() {
    return this.prisma.dataExportRequest.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      select: {
        id: true,
        userId: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }
}
