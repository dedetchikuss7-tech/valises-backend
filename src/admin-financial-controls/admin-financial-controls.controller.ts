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
import { AdminFinancialControlsService } from './admin-financial-controls.service';
import { AdminFinancialControlResponseDto } from './dto/admin-financial-control-response.dto';
import { AdminFinancialControlsSummaryResponseDto } from './dto/admin-financial-controls-summary-response.dto';
import { ListAdminFinancialControlsQueryDto } from './dto/list-admin-financial-controls-query.dto';

@ApiTags('Admin Financial Controls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/financial-controls')
export class AdminFinancialControlsController {
  constructor(
    private readonly adminFinancialControlsService: AdminFinancialControlsService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get financial controls summary',
    description:
      'Returns consolidated ledger and settlement control counts.',
  })
  @ApiOkResponse({
    description: 'Financial controls summary',
    type: AdminFinancialControlsSummaryResponseDto,
  })
  async getSummary() {
    return this.adminFinancialControlsService.getSummary();
  }

  @Get('cases')
  @ApiOperation({
    summary: 'List financial control rows',
    description:
      'Returns consolidated transaction-level financial control rows across ledger, payouts, and refunds.',
  })
  @ApiOkResponse({
    description: 'Financial control row list',
    type: AdminFinancialControlResponseDto,
    isArray: true,
  })
  async listCases(@Query() query: ListAdminFinancialControlsQueryDto) {
    return this.adminFinancialControlsService.listControls(query);
  }
}