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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DisputeService } from './dispute.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { GetDisputeRecommendationDto } from './dto/get-dispute-recommendation.dto';

@ApiTags('Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('disputes')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) throw new UnauthorizedException('Missing auth (Bearer token required)');
    return id;
  }

  @Post()
  async create(@Req() req: any, @Body() body: CreateDisputeDto) {
    return this.disputeService.create({
      transactionId: body.transactionId,
      openedById: this.userId(req),
      reason: body.reason,
      reasonCode: body.reasonCode,
    });
  }

  @Get()
  @Roles('ADMIN')
  async findAll() {
    return this.disputeService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN')
  async findOne(@Param('id') id: string) {
    return this.disputeService.findOne(id);
  }

  @Get(':id/recommendation')
  @Roles('ADMIN')
  async recommendation(@Param('id') id: string, @Query() query: GetDisputeRecommendationDto) {
    return this.disputeService.getRecommendation(id, query);
  }

  @Patch(':id/resolve')
  @Roles('ADMIN')
  async resolve(@Param('id') id: string, @Body() body: ResolveDisputeDto) {
    return this.disputeService.resolve(id, body);
  }
}