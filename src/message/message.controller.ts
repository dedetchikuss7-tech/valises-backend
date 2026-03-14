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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ListMessagesQueryDto } from './dto/list-messages.query.dto';

@ApiTags('Message')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('transactions/:transactionId/messages')
export class MessageController {
  constructor(private readonly service: MessageService) {}

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

  @Post()
  @ApiOperation({ summary: 'Send a message in a transaction conversation' })
  async send(
    @Req() req: any,
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Body() body: SendMessageDto,
  ) {
    return this.service.sendMessage(transactionId, this.requester(req), body.content);
  }

  @Get()
  @ApiOperation({ summary: 'List messages of a transaction conversation' })
  async list(
    @Req() req: any,
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.service.listMessages(transactionId, this.requester(req), {
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}