// src/dispute/dispute.controller.ts
import { Body, Controller, Get, Post } from '@nestjs/common';
import { DisputeService } from './dispute.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';

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
}