import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { CorridorPublicService } from './corridor-public.service';

@ApiTags('corridors')
@Controller('corridors')
export class CorridorPublicController {
  constructor(private readonly corridorPublicService: CorridorPublicService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all active corridors (public, cached 5min)' })
  async listActiveCorridors() {
    return this.corridorPublicService.listActiveCorridors();
  }

  @Get(':code')
  @Public()
  @ApiOperation({ summary: 'Get corridor detail by code (public, cached 5min)' })
  async getCorridorByCode(@Param('code') code: string) {
    return this.corridorPublicService.getCorridorByCode(code);
  }
}
