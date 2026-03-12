import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { AbandonmentService } from './abandonment.service';
import { MarkAbandonedDto } from './dto/mark-abandoned.dto';
import { ResolveAbandonedDto } from './dto/resolve-abandoned.dto';
import { ProcessRemindersDto } from './dto/process-reminders.dto';

@ApiTags('Abandonment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('abandonment')
export class AbandonmentController {
  constructor(private readonly abandonmentService: AbandonmentService) {}

  private requester(req: any) {
    const userId = req?.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }

    return {
      userId,
      role: req.user.role,
    };
  }

  @Post('mark')
  @ApiOperation({ summary: 'Mark an abandonment event and schedule reminders' })
  async markAbandoned(@Req() req: any, @Body() dto: MarkAbandonedDto) {
    return this.abandonmentService.markAbandoned(this.requester(req), dto);
  }

  @Post('resolve')
  @ApiOperation({ summary: 'Resolve an abandonment event and cancel pending reminders' })
  async resolveAbandoned(@Req() req: any, @Body() dto: ResolveAbandonedDto) {
    return this.abandonmentService.resolveAbandoned(this.requester(req), dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'List my abandonment events' })
  async listMine(@Req() req: any) {
    return this.abandonmentService.listMyEvents(this.requester(req));
  }

  @Post('process-due')
  @ApiOperation({ summary: 'Process due reminder jobs (admin only)' })
  async processDue(@Req() req: any, @Body() dto: ProcessRemindersDto) {
    return this.abandonmentService.processDueReminders(
      this.requester(req),
      dto.limit ?? 20,
    );
  }
}