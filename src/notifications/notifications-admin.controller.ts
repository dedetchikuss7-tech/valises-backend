import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { FailedNotificationsQueryDto } from './dto/failed-notifications.dto';

@ApiTags('admin-notifications')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/notifications')
export class NotificationsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('failed')
  @ApiOperation({
    summary: 'List failed notification outbox entries (DLQ review)',
    description:
      'Returns outbox entries that have been attempted at least once but not yet sent. ' +
      'Covers PENDING (retrying) and FAILED status entries.',
  })
  async getFailedNotifications(@Query() query: FailedNotificationsQueryDto) {
    const limit = Math.min(query.limit ?? 20, 100);

    let rows: any[];

    if (query.cursor) {
      rows = await this.prisma.$queryRaw<any[]>`
        SELECT
          id,
          recipient_user_id,
          channel,
          status,
          template_key,
          event_type,
          attempt_count,
          scheduled_for,
          sent_at,
          failed_at,
          failure_reason,
          metadata->>'idempotency_key' AS idempotency_key,
          created_at,
          updated_at
        FROM notification_outbox
        WHERE sent_at IS NULL
          AND attempt_count > 0
          AND created_at < (
            SELECT created_at FROM notification_outbox WHERE id = ${query.cursor} LIMIT 1
          )
        ORDER BY created_at DESC
        LIMIT ${limit + 1}
      `;
    } else {
      rows = await this.prisma.$queryRaw<any[]>`
        SELECT
          id,
          recipient_user_id,
          channel,
          status,
          template_key,
          event_type,
          attempt_count,
          scheduled_for,
          sent_at,
          failed_at,
          failure_reason,
          metadata->>'idempotency_key' AS idempotency_key,
          created_at,
          updated_at
        FROM notification_outbox
        WHERE sent_at IS NULL
          AND attempt_count > 0
        ORDER BY created_at DESC
        LIMIT ${limit + 1}
      `;
    }

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

    return { data, hasMore, nextCursor };
  }
}
