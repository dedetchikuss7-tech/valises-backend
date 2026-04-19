import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminOpsService } from './admin-ops.service';
import { AdminOpsDashboardResponseDto } from './dto/admin-ops-dashboard-response.dto';
import { AdminOpsCaseResponseDto } from './dto/admin-ops-case-response.dto';
import { ListAdminOpsCasesQueryDto } from './dto/list-admin-ops-cases-query.dto';

@ApiTags('Admin Ops')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/ops')
export class AdminOpsController {
  constructor(private readonly adminOpsService: AdminOpsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get consolidated admin ops dashboard counts',
    description:
      'Returns unified admin/ops counts across AML, disputes, restrictions, payouts, refunds, abandonment, reminders, and shortlist visibility.',
  })
  @ApiOkResponse({
    description: 'Consolidated admin ops dashboard',
    type: AdminOpsDashboardResponseDto,
  })
  async getDashboard() {
    return this.adminOpsService.getDashboard();
  }

  @Get('cases')
  @ApiOperation({
    summary: 'List consolidated admin ops cases',
    description:
      'Returns a unified admin/ops case feed across AML, disputes, restrictions, payouts, refunds, and abandonment signals.',
  })
  @ApiOkResponse({
    description: 'Unified admin ops case feed',
    type: AdminOpsCaseResponseDto,
    isArray: true,
  })
  async listCases(@Query() query: ListAdminOpsCasesQueryDto) {
    return this.adminOpsService.listCases(query);
  }
}