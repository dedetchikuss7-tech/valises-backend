import { Body, Controller, Get, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { BulkActionResultDto } from '../common/dto/bulk-action-result.dto';
import { BulkAdminFinancialControlReviewDto } from './dto/bulk-admin-financial-control-review.dto';
import { AdminFinancialControlResponseDto } from './dto/admin-financial-control-response.dto';
import { AdminFinancialControlsSummaryResponseDto } from './dto/admin-financial-controls-summary-response.dto';
import { ListAdminFinancialControlsQueryDto } from './dto/list-admin-financial-controls-query.dto';
import { AdminFinancialControlsService } from './admin-financial-controls.service';

@ApiTags('Admin Financial Controls')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/financial-controls')
export class AdminFinancialControlsController {
  constructor(
    private readonly adminFinancialControlsService: AdminFinancialControlsService,
  ) {}

  private adminId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get financial controls summary',
  })
  @ApiOkResponse({ type: AdminFinancialControlsSummaryResponseDto })
  async getSummary() {
    return this.adminFinancialControlsService.getSummary();
  }

  @Get('cases')
  @ApiOperation({
    summary: 'List financial control rows',
  })
  async listCases(@Query() query: ListAdminFinancialControlsQueryDto) {
    return this.adminFinancialControlsService.listControls(query);
  }

  @Post('cases/bulk/ack')
  @ApiOperation({
    summary: 'Bulk acknowledge financial control rows',
  })
  @ApiBody({ type: BulkAdminFinancialControlReviewDto })
  @ApiOkResponse({ type: BulkActionResultDto })
  async bulkAcknowledge(
    @Req() req: any,
    @Body() body: BulkAdminFinancialControlReviewDto,
  ) {
    return this.adminFinancialControlsService.bulkAcknowledgeControls(
      this.adminId(req),
      body,
    );
  }
}