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
import { ApiBearerAuth, ApiForbiddenResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiForbiddenResponse({
    description: 'Message blocked by anti-circumvention or anti-spam rules.',
    schema: {
      examples: {
        contact: {
          summary: 'Blocked external contact sharing',
          value: {
            statusCode: 403,
            message: {
              code: 'MESSAGE_BLOCKED_CONTACT',
              message:
                'Message blocked because it appears to contain forbidden external contact information',
            },
            error: 'Forbidden',
          },
        },
        duplicate: {
          summary: 'Blocked duplicate message',
          value: {
            statusCode: 403,
            message: {
              code: 'MESSAGE_BLOCKED_DUPLICATE',
              message: 'Duplicate message blocked',
            },
            error: 'Forbidden',
          },
        },
        cooldown: {
          summary: 'Blocked by cooldown',
          value: {
            statusCode: 403,
            message: {
              code: 'MESSAGE_BLOCKED_COOLDOWN',
              message: 'Please slow down before sending another message',
            },
            error: 'Forbidden',
          },
        },
      },
    },
  })
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