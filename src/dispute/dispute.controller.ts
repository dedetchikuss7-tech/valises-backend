import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { GetDisputeRecommendationDto } from './dto/get-dispute-recommendation.dto';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { DisputeService } from './dispute.service';

@ApiTags('Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('disputes')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  private userRole(req: any): Role {
    const role = req?.user?.role;
    if (!role) {
      throw new UnauthorizedException('Missing auth role');
    }
    return role as Role;
  }

  @Post()
  @ApiOperation({
    summary: 'Open a dispute',
    description:
      'Authenticated endpoint opening a dispute for a transaction. openedById is always taken from the JWT user. opening metadata is inferred and stored structurally.',
  })
  @ApiBody({ type: CreateDisputeDto })
  async create(@Req() req: any, @Body() body: CreateDisputeDto) {
    return this.disputeService.create({
      transactionId: body.transactionId,
      openedById: this.userId(req),
      actorRole: this.userRole(req),
      reason: body.reason,
      reasonCode: body.reasonCode,
    });
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List disputes',
    description:
      'Admin-only endpoint returning disputes with linked resolution, money-flow context, and structured opening metadata filters.',
  })
  async findAll(@Query() query: ListDisputesQueryDto) {
    return this.disputeService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get one dispute',
    description:
      'Admin-only endpoint returning one dispute with its linked resolution and transaction context.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  async findOne(@Param('id') id: string) {
    return this.disputeService.findOne(id);
  }

  @Get(':id/recommendation')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get dispute recommendation',
    description:
      'Admin-only endpoint returning the matrix recommendation for a dispute based on reason, evidence level, and delivery context.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  async recommendation(
    @Param('id') id: string,
    @Query() query: GetDisputeRecommendationDto,
  ) {
    return this.disputeService.getRecommendation(id, query);
  }

  @Patch(':id/resolve')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Resolve dispute',
    description:
      'Admin-only endpoint resolving a dispute and orchestrating payout/refund flows when applicable.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiBody({ type: ResolveDisputeDto })
  async resolve(@Param('id') id: string, @Body() body: ResolveDisputeDto) {
    return this.disputeService.resolve(id, body);
  }
}