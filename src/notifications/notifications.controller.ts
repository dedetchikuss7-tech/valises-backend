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
import { EmitNotificationDto } from './dto/emit-notification.dto';
import { ListMyNotificationsQueryDto } from './dto/list-my-notifications-query.dto';
import { ListNotificationOutboxQueryDto } from './dto/list-notification-outbox-query.dto';
import { NotificationOutboxResponseDto } from './dto/notification-outbox-response.dto';
import { NotificationResponseDto } from './dto/notification-response.dto';
import { ProcessNotificationOutboxDto } from './dto/process-notification-outbox.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Get('me')
  @ApiOperation({
    summary: 'List my notifications',
    description:
      'Returns the unified notification feed for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'User notifications',
    type: NotificationResponseDto,
    isArray: true,
  })
  async listMine(@Req() req: any, @Query() query: ListMyNotificationsQueryDto) {
    return this.notificationsService.listMyNotifications(this.userId(req), query);
  }

  @Post(':notificationId/ack')
  @ApiOperation({
    summary: 'Acknowledge one notification',
    description:
      'Marks one notification as read/acknowledged for the authenticated user.',
  })
  @ApiParam({ name: 'notificationId', description: 'Notification id' })
  @ApiOkResponse({
    description: 'Acknowledged notification',
    type: NotificationResponseDto,
  })
  async acknowledge(
    @Req() req: any,
    @Param('notificationId') notificationId: string,
  ) {
    return this.notificationsService.acknowledgeNotification(
      notificationId,
      this.userId(req),
    );
  }

  @Post('emit')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Emit one notification',
    description:
      'Admin-only endpoint used to emit a normalized notification envelope and enqueue an outbox row.',
  })
  @ApiBody({ type: EmitNotificationDto })
  @ApiOkResponse({
    description: 'Emitted notification',
    type: NotificationResponseDto,
  })
  async emit(@Req() req: any, @Body() body: EmitNotificationDto) {
    return this.notificationsService.emitNotification(this.userId(req), body);
  }

  @Get('admin/outbox')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: list notification outbox',
  })
  async listOutbox(@Query() query: ListNotificationOutboxQueryDto) {
    return this.notificationsService.listOutbox(query);
  }

  @Post('admin/outbox/process-due')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: process due notification outbox rows',
  })
  async processDue(@Body() body: ProcessNotificationOutboxDto) {
    return this.notificationsService.processDueOutbox(body);
  }

  @Post('admin/outbox/:id/retry')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: retry failed or cancelled notification outbox row',
  })
  @ApiParam({ name: 'id', description: 'Notification outbox id' })
  @ApiOkResponse({ type: NotificationOutboxResponseDto })
  async retryOutbox(@Param('id') id: string) {
    return this.notificationsService.retryOutbox(id);
  }

  @Post('admin/outbox/:id/cancel')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Admin: cancel notification outbox row',
  })
  @ApiParam({ name: 'id', description: 'Notification outbox id' })
  @ApiOkResponse({ type: NotificationOutboxResponseDto })
  async cancelOutbox(@Param('id') id: string) {
    return this.notificationsService.cancelOutbox(id);
  }
}