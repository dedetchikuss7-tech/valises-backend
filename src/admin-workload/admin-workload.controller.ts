import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminWorkloadService } from './admin-workload.service';
import { AdminWorkloadSummaryResponseDto } from './dto/admin-workload-summary-response.dto';
import { AdminWorkloadAssigneeListResponseDto } from './dto/admin-workload-assignee-response.dto';
import {
  AdminWorkloadQueuePreset,
  ListAdminWorkloadQueueQueryDto,
} from './dto/list-admin-workload-queue-query.dto';

@ApiTags('Admin Workload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/workload')
export class AdminWorkloadController {
  constructor(private readonly adminWorkloadService: AdminWorkloadService) {}

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
}