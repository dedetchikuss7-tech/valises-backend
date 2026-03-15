import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  AbandonmentEventStatus,
  AbandonmentKind,
  ReminderChannel,
  ReminderJobStatus,
} from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { AdminAbandonmentService } from './admin-abandonment.service';
import { ListAbandonmentEventsQueryDto } from './dto/list-abandonment-events.query.dto';
import { ListReminderJobsQueryDto } from './dto/list-reminder-jobs.query.dto';
import { ListDueReminderJobsQueryDto } from './dto/list-due-reminder-jobs.query.dto';

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
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter by user ID',
    example: '459e66d1-121d-429b-82cc-163baf21b052',
    type: String,
  })
  @ApiQuery({
    name: 'kind',
    required: false,
    description: 'Filter by abandonment kind',
    enum: AbandonmentKind,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by abandonment event status',
    enum: AbandonmentEventStatus,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of items to return',
    type: Number,
    example: 20,
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
  @ApiQuery({
    name: 'abandonmentEventId',
    required: false,
    description: 'Filter by abandonment event ID',
    example: '04c6ef4f-980b-4cf7-9006-2ddba4003420',
    type: String,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by reminder job status',
    enum: ReminderJobStatus,
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    description: 'Filter by reminder channel',
    enum: ReminderChannel,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of items to return',
    type: Number,
    example: 20,
  })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async listReminderJobs(@Query() query: ListReminderJobsQueryDto) {
    return this.service.listReminderJobs(query);
  }

  @Get('reminder-jobs/due')
  @ApiOperation({
    summary: 'List due reminder jobs',
    description:
      'Admin-only endpoint returning pending reminder jobs already due for processing.',
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    description: 'Filter due reminder jobs by channel',
    enum: ReminderChannel,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of items to return',
    type: Number,
    example: 20,
  })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async listDueReminderJobs(@Query() query: ListDueReminderJobsQueryDto) {
    return this.service.listDueReminderJobs(query);
  }

  @Post('reminder-jobs/due/trigger')
  @ApiOperation({
    summary: 'Trigger due reminder jobs in batch',
    description:
      'Admin-only endpoint forcing already due reminder jobs to be sent in batch.',
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    description: 'Filter due reminder jobs by channel',
    enum: ReminderChannel,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of due jobs to process',
    type: Number,
    example: 20,
  })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async triggerDueReminderJobs(@Query() query: ListDueReminderJobsQueryDto) {
    return this.service.triggerDueReminderJobs(query);
  }

  @Post('reminder-jobs/due/cancel')
  @ApiOperation({
    summary: 'Cancel due reminder jobs in batch',
    description:
      'Admin-only endpoint cancelling already due reminder jobs in batch.',
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    description: 'Filter due reminder jobs by channel',
    enum: ReminderChannel,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of due jobs to cancel',
    type: Number,
    example: 20,
  })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async cancelDueReminderJobs(@Query() query: ListDueReminderJobsQueryDto) {
    return this.service.cancelDueReminderJobs(query);
  }

  @Post('reminder-jobs/:id/trigger')
  @ApiOperation({
    summary: 'Trigger one reminder job manually',
    description:
      'Admin-only endpoint forcing a reminder job to be sent immediately.',
  })
  @ApiParam({ name: 'id', description: 'Reminder job ID' })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async triggerReminderJob(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.triggerReminderJob(id);
  }

  @Post('reminder-jobs/:id/cancel')
  @ApiOperation({
    summary: 'Cancel one reminder job',
    description:
      'Admin-only endpoint cancelling a pending or failed reminder job.',
  })
  @ApiParam({ name: 'id', description: 'Reminder job ID' })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async cancelReminderJob(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.cancelReminderJob(id);
  }

  @Post('reminder-jobs/:id/retry')
  @ApiOperation({
    summary: 'Retry one reminder job',
    description:
      'Admin-only endpoint re-queueing a failed or cancelled reminder job for immediate processing.',
  })
  @ApiParam({ name: 'id', description: 'Reminder job ID' })
  @ApiForbiddenResponse({
    description: 'Admin role required.',
  })
  async retryReminderJob(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.service.retryReminderJob(id);
  }
}