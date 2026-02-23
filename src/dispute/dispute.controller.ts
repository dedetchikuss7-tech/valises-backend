import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { GetDisputeRecommendationDto } from './dto/get-dispute-recommendation.dto';

@Controller('disputes')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  async create(@Body() body: CreateDisputeDto) {
    return this.disputeService.create(body);
  }

  @Get()
  async findAll() {
    return this.disputeService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.disputeService.findOne(id);
  }

  @Get(':id/recommendation')
  async recommendation(
    @Param('id') id: string,
    @Query() query: GetDisputeRecommendationDto,
  ) {
    return this.disputeService.getRecommendation(id, query);
  }

  @Patch(':id/resolve')
  async resolve(@Param('id') id: string, @Body() body: ResolveDisputeDto) {
    return this.disputeService.resolve(id, body);
  }
}