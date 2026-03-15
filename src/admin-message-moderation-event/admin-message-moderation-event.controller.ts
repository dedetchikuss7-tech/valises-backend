import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { AdminMessageModerationEventService } from './admin-message-moderation-event.service';
import { ListMessageModerationEventsQueryDto } from './dto/list-message-moderation-events.query.dto';

@ApiTags('Admin Message Moderation Events')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/message-moderation-events')
export class AdminMessageModerationEventController {
  constructor(private readonly service: AdminMessageModerationEventService) {}

  @Get()
  @ApiOperation({
    summary: 'List persisted message moderation events',
    description:
      'Admin-only endpoint returning persisted blocked/sanitized messaging moderation events with optional filters.',
  })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async list(@Query() query: ListMessageModerationEventsQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one persisted message moderation event',
    description:
      'Admin-only endpoint returning one persisted messaging moderation event by id.',
  })
  @ApiParam({ name: 'id', description: 'Message moderation event ID' })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findOne(id);
  }
}