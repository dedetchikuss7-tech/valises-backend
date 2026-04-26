import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminWorkloadService } from './admin-workload.service';
import { AdminWorkloadDrilldownService } from './admin-workload-drilldown.service';
import { AdminWorkloadSummaryResponseDto } from './dto/admin-workload-summary-response.dto';
import { AdminWorkloadAssigneeListResponseDto } from './dto/admin-workload-assignee-response.dto';
import {
  AdminWorkloadQueuePreset,
  ListAdminWorkloadQueueQueryDto,
} from './dto/list-admin-workload-queue-query.dto';
import { AdminWorkloadActionTargetDto } from './dto/admin-workload-action-target.dto';
import { UpdateAdminWorkloadStatusDto } from './dto/update-admin-workload-status.dto';
import {
  BulkAdminWorkloadActionDto,
  BulkAdminWorkloadStatusActionDto,
} from './dto/bulk-admin-workload-action.dto';
import { AdminWorkloadBulkActionResultDto } from './dto/admin-workload-action-result.dto';
import { AdminWorkloadItemResponseDto } from './dto/admin-workload-item-response.dto';
import { AdminWorkloadOverviewResponseDto } from './dto/admin-workload-overview-response.dto';
import {
  AdminWorkloadDrilldownPreset,
  AdminWorkloadDrilldownPresetListResponseDto,
} from './dto/admin-workload-drilldown.dto';
import { ListAdminWorkloadDrilldownQueryDto } from './dto/list-admin-workload-drilldown-query.dto';

@ApiTags('Admin Workload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/workload')
export class AdminWorkloadController {
  constructor(
    private readonly adminWorkloadService: AdminWorkloadService,
    private readonly adminWorkloadDrilldownService: AdminWorkloadDrilldownService,
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
    summary: 'Get admin workload summary',
  })
  @ApiOkResponse({ type: AdminWorkloadSummaryResponseDto })
  async getSummary(@Req() req: any) {
    return this.adminWorkloadService.getSummary(this.adminId(req));
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Get admin workload operational overview',
  })
  @ApiOkResponse({ type: AdminWorkloadOverviewResponseDto })
  async getOverview(@Req() req: any) {
    return this.adminWorkloadService.getOverview(this.adminId(req));
  }

  @Get('drilldowns')
  @ApiOperation({
    summary: 'List available admin workload drilldown presets',
  })
  @ApiOkResponse({ type: AdminWorkloadDrilldownPresetListResponseDto })
  async listDrilldownPresets() {
    return this.adminWorkloadDrilldownService.listPresets();
  }

  @Get('drilldowns/:preset')
  @ApiOperation({
    summary: 'List one admin workload drilldown preset',
  })
  @ApiParam({ name: 'preset', enum: AdminWorkloadDrilldownPreset })
  async listDrilldown(
    @Req() req: any,
    @Param('preset') preset: AdminWorkloadDrilldownPreset,
    @Query() query: ListAdminWorkloadDrilldownQueryDto,
  ) {
    return this.adminWorkloadDrilldownService.listDrilldown(
      this.adminId(req),
      preset,
      query,
    );
  }

  @Get('assignees')
  @ApiOperation({
    summary: 'Get workload distribution by assigned admin',
  })
  @ApiOkResponse({ type: AdminWorkloadAssigneeListResponseDto })
  async listAssignees() {
    return this.adminWorkloadService.listAssignees();
  }

  @Get('queues/:preset')
  @ApiOperation({
    summary: 'List one admin workload queue preset',
  })
  @ApiParam({ name: 'preset', enum: AdminWorkloadQueuePreset })
  async listQueue(
    @Req() req: any,
    @Param('preset') preset: AdminWorkloadQueuePreset,
    @Query() query: ListAdminWorkloadQueueQueryDto,
  ) {
    return this.adminWorkloadService.listQueue(
      this.adminId(req),
      preset,
      query,
    );
  }

  @Post('actions/claim')
  @ApiOperation({
    summary: 'Claim one workload item',
  })
  @ApiBody({ type: AdminWorkloadActionTargetDto })
  @ApiOkResponse({ type: AdminWorkloadItemResponseDto })
  async claim(@Req() req: any, @Body() body: AdminWorkloadActionTargetDto) {
    return this.adminWorkloadService.claim(this.adminId(req), body);
  }

  @Post('actions/release')
  @ApiOperation({
    summary: 'Release one workload item',
  })
  @ApiBody({ type: AdminWorkloadActionTargetDto })
  @ApiOkResponse({ type: AdminWorkloadItemResponseDto })
  async release(@Req() req: any, @Body() body: AdminWorkloadActionTargetDto) {
    return this.adminWorkloadService.release(this.adminId(req), body);
  }

  @Post('actions/status')
  @ApiOperation({
    summary: 'Update one workload item operational status',
  })
  @ApiBody({ type: UpdateAdminWorkloadStatusDto })
  @ApiOkResponse({ type: AdminWorkloadItemResponseDto })
  async updateStatus(
    @Req() req: any,
    @Body() body: UpdateAdminWorkloadStatusDto,
  ) {
    return this.adminWorkloadService.updateStatus(this.adminId(req), body);
  }

  @Post('actions/bulk-claim')
  @ApiOperation({
    summary: 'Bulk claim workload items',
  })
  @ApiBody({ type: BulkAdminWorkloadActionDto })
  @ApiOkResponse({ type: AdminWorkloadBulkActionResultDto })
  async bulkClaim(@Req() req: any, @Body() body: BulkAdminWorkloadActionDto) {
    return this.adminWorkloadService.bulkClaim(this.adminId(req), body);
  }

  @Post('actions/bulk-release')
  @ApiOperation({
    summary: 'Bulk release workload items',
  })
  @ApiBody({ type: BulkAdminWorkloadActionDto })
  @ApiOkResponse({ type: AdminWorkloadBulkActionResultDto })
  async bulkRelease(@Req() req: any, @Body() body: BulkAdminWorkloadActionDto) {
    return this.adminWorkloadService.bulkRelease(this.adminId(req), body);
  }

  @Post('actions/bulk-status')
  @ApiOperation({
    summary: 'Bulk update workload item operational status',
  })
  @ApiBody({ type: BulkAdminWorkloadStatusActionDto })
  @ApiOkResponse({ type: AdminWorkloadBulkActionResultDto })
  async bulkUpdateStatus(
    @Req() req: any,
    @Body() body: BulkAdminWorkloadStatusActionDto,
  ) {
    return this.adminWorkloadService.bulkUpdateStatus(
      this.adminId(req),
      body,
    );
  }
}