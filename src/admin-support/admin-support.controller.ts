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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminSupportService } from './admin-support.service';
import type { SupportNoteTargetType } from './dto/add-support-note.dto';
import { AddSupportNoteDto, SUPPORT_NOTE_TARGET_TYPES } from './dto/add-support-note.dto';
import { SupportNoteResponseDto } from './dto/support-note-response.dto';

@ApiTags('Admin Support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin-support')
export class AdminSupportController {
  constructor(private readonly adminSupportService: AdminSupportService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Post('notes')
  @ApiOperation({ summary: 'Add a support note to any entity' })
  @ApiBody({ type: AddSupportNoteDto })
  @ApiOkResponse({ type: SupportNoteResponseDto })
  async addSupportNote(
    @Req() req: any,
    @Body() dto: AddSupportNoteDto,
  ): Promise<SupportNoteResponseDto> {
    return this.adminSupportService.addSupportNote(this.userId(req), dto);
  }

  @Get('notes/:targetType/:targetId')
  @ApiOperation({ summary: 'List support notes for a given entity' })
  @ApiParam({ name: 'targetType', enum: SUPPORT_NOTE_TARGET_TYPES })
  @ApiParam({ name: 'targetId', type: String })
  @ApiOkResponse({ type: SupportNoteResponseDto, isArray: true })
  async getSupportNotes(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ): Promise<SupportNoteResponseDto[]> {
    return this.adminSupportService.getSupportNotes(targetType as SupportNoteTargetType, targetId);
  }

  @Get('transactions/search')
  @ApiOperation({ summary: 'Search transactions with support filters' })
  @ApiQuery({ name: 'email', required: false })
  @ApiQuery({ name: 'status', required: false, enum: TransactionStatus })
  @ApiQuery({ name: 'corridorCode', required: false })
  @ApiQuery({ name: 'dateFrom', required: false, type: String })
  @ApiQuery({ name: 'dateTo', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async searchTransactions(
    @Query('email') email?: string,
    @Query('status') status?: TransactionStatus,
    @Query('corridorCode') corridorCode?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.adminSupportService.searchTransactions({
      email,
      status,
      corridorCode,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('transactions/:id/view')
  @ApiOperation({ summary: 'Full support view of a transaction' })
  @ApiParam({ name: 'id', type: String })
  async getTransactionSupportView(
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.adminSupportService.getTransactionSupportView(id);
  }

  @Post('webhooks/:eventId/resend')
  @ApiOperation({ summary: 'Resend a stored provider webhook event' })
  @ApiParam({ name: 'eventId', type: String })
  async resendWebhookEvent(
    @Param('eventId', new ParseUUIDPipe()) eventId: string,
  ) {
    return this.adminSupportService.resendWebhookEvent(eventId);
  }
}
