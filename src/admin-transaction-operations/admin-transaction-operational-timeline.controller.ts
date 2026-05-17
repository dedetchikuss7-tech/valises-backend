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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminTransactionOperationalTimelineService } from './admin-transaction-operational-timeline.service';
import { AdminTransactionOperationalTimelineResponseDto } from './dto/admin-transaction-operational-timeline-response.dto';
import { ListAdminTransactionOperationalTimelineQueryDto } from './dto/list-admin-transaction-operational-timeline-query.dto';

@ApiTags('Admin Transaction Operational Timeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/transaction-operations')
export class AdminTransactionOperationalTimelineController {
  constructor(
    private readonly timelineService: AdminTransactionOperationalTimelineService,
  ) {}

  @Get('transactions/:transactionId/timeline')
  @ApiOperation({
    summary: 'Get consolidated transaction operational timeline',
  })
  @ApiOkResponse({
    type: AdminTransactionOperationalTimelineResponseDto,
  })
  async getTimeline(
    @Param('transactionId', new ParseUUIDPipe())
    transactionId: string,
    @Query()
    query: ListAdminTransactionOperationalTimelineQueryDto,
  ) {
    return this.timelineService.getTimeline(transactionId, query);
  }
}