import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminActionAuditService } from './admin-action-audit.service';
import { ListAdminActionAuditsQueryDto } from './dto/list-admin-action-audits-query.dto';

@ApiTags('Admin Action Audits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/action-audits')
export class AdminActionAuditController {
  constructor(
    private readonly adminActionAuditService: AdminActionAuditService,
  ) {}

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List admin action audits',
    description: 'Admin-only endpoint returning admin action audit records with optional filters.',
  })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'targetType', required: false, type: String })
  @ApiQuery({ name: 'targetId', required: false, type: String })
  @ApiQuery({ name: 'actorUserId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async list(@Query() query: ListAdminActionAuditsQueryDto) {
    return this.adminActionAuditService.list(query);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get one admin action audit',
    description: 'Admin-only endpoint returning one admin action audit record by id.',
  })
  @ApiParam({ name: 'id', description: 'Admin action audit UUID' })
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminActionAuditService.getOne(id);
  }
}