import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { AdminTimelineObjectType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminTimelineService } from './admin-timeline.service';
import { CreateAdminTimelineEventDto } from './dto/create-admin-timeline-event.dto';
import { AdminTimelineEventResponseDto } from './dto/admin-timeline-event-response.dto';
import { ListAdminTimelineEventsQueryDto } from './dto/list-admin-timeline-events-query.dto';

@ApiTags('Admin Timeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/timeline')
export class AdminTimelineController {
  constructor(private readonly adminTimelineService: AdminTimelineService) {}

  private adminId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Get()
  @ApiOperation({
    summary: 'List admin timeline events',
  })
  async list(@Query() query: ListAdminTimelineEventsQueryDto) {
    return this.adminTimelineService.list(query);
  }

  @Get('events/:id')
  @ApiOperation({
    summary: 'Get one admin timeline event',
  })
  @ApiParam({ name: 'id', description: 'Admin timeline event UUID' })
  @ApiOkResponse({ type: AdminTimelineEventResponseDto })
  async getOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminTimelineService.getOne(id);
  }

  @Get(':objectType/:objectId')
  @ApiOperation({
    summary: 'List admin timeline events for one object',
  })
  @ApiParam({ name: 'objectType', enum: AdminTimelineObjectType })
  @ApiParam({ name: 'objectId', type: String })
  async listForObject(
    @Param('objectType') objectType: AdminTimelineObjectType,
    @Param('objectId') objectId: string,
    @Query() query: ListAdminTimelineEventsQueryDto,
  ) {
    return this.adminTimelineService.listForObject(objectType, objectId, query);
  }

  @Post('events')
  @ApiOperation({
    summary: 'Create a manual admin timeline event',
  })
  @ApiBody({ type: CreateAdminTimelineEventDto })
  @ApiOkResponse({ type: AdminTimelineEventResponseDto })
  async createManualEvent(
    @Req() req: any,
    @Body() body: CreateAdminTimelineEventDto,
  ) {
    return this.adminTimelineService.createManualEvent(this.adminId(req), body);
  }
}