import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { AdminAbandonmentService } from './admin-abandonment.service';
import { ListAbandonmentEventsQueryDto } from './dto/list-abandonment-events.query.dto';
import { ListReminderJobsQueryDto } from './dto/list-reminder-jobs.query.dto';

@ApiTags('Admin Abandonment')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin')
export class AdminAbandonmentController {
  constructor(private readonly service: AdminAbandonmentService) {}

  @Get('abandonment-events')
  @ApiOperation({
    summary: 'List abandonment events',
    description:
      'Admin-only endpoint returning abandonment events with optional filters.',
  })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async listAbandonmentEvents(@Query() query: ListAbandonmentEventsQueryDto) {
    return this.service.listAbandonmentEvents(query);
  }

  @Get('abandonment-events/:id')
  @ApiOperation({
    summary: 'Get one abandonment event',
    description:
      'Admin-only endpoint returning one abandonment event with its reminder jobs.',
  })
  @ApiParam({ name: 'id', description: 'Abandonment event ID' })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async findAbandonmentEvent(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.findAbandonmentEvent(id);
  }

  @Get('reminder-jobs')
  @ApiOperation({
    summary: 'List reminder jobs',
    description:
      'Admin-only endpoint returning reminder jobs with optional filters.',
  })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async listReminderJobs(@Query() query: ListReminderJobsQueryDto) {
    return this.service.listReminderJobs(query);
  }
}