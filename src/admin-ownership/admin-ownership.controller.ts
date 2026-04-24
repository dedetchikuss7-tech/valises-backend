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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOwnershipObjectType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClaimAdminOwnershipDto } from './dto/claim-admin-ownership.dto';
import { ReleaseAdminOwnershipDto } from './dto/release-admin-ownership.dto';
import { UpdateAdminOwnershipStatusDto } from './dto/update-admin-ownership-status.dto';
import { ListAdminOwnershipQueryDto } from './dto/list-admin-ownership-query.dto';
import { AdminOwnershipResponseDto } from './dto/admin-ownership-response.dto';
import { AdminOwnershipSummaryResponseDto } from './dto/admin-ownership-summary-response.dto';
import { AdminOwnershipService } from './admin-ownership.service';

@ApiTags('Admin Ownership')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/ownership')
export class AdminOwnershipController {
  constructor(private readonly adminOwnershipService: AdminOwnershipService) {}

  private adminId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get admin ownership SLA summary',
  })
  @ApiOkResponse({ type: AdminOwnershipSummaryResponseDto })
  async getSummary() {
    return this.adminOwnershipService.getSummary();
  }

  @Get()
  @ApiOperation({
    summary: 'List admin ownership rows',
  })
  async list(@Query() query: ListAdminOwnershipQueryDto) {
    return this.adminOwnershipService.list(query);
  }

  @Get(':objectType/:objectId')
  @ApiOperation({
    summary: 'Get one admin ownership row',
  })
  @ApiParam({ name: 'objectType', enum: AdminOwnershipObjectType })
  @ApiParam({ name: 'objectId', type: String })
  @ApiOkResponse({ type: AdminOwnershipResponseDto })
  async getOne(
    @Param('objectType') objectType: AdminOwnershipObjectType,
    @Param('objectId') objectId: string,
  ) {
    return this.adminOwnershipService.getOne(objectType, objectId);
  }

  @Post('claim')
  @ApiOperation({
    summary: 'Claim one admin operational object',
  })
  @ApiBody({ type: ClaimAdminOwnershipDto })
  @ApiOkResponse({ type: AdminOwnershipResponseDto })
  async claim(@Req() req: any, @Body() body: ClaimAdminOwnershipDto) {
    return this.adminOwnershipService.claim(this.adminId(req), body);
  }

  @Post('release')
  @ApiOperation({
    summary: 'Release one admin operational object',
  })
  @ApiBody({ type: ReleaseAdminOwnershipDto })
  @ApiOkResponse({ type: AdminOwnershipResponseDto })
  async release(@Req() req: any, @Body() body: ReleaseAdminOwnershipDto) {
    return this.adminOwnershipService.release(this.adminId(req), body);
  }

  @Patch('status')
  @ApiOperation({
    summary: 'Update admin ownership operational status',
  })
  @ApiBody({ type: UpdateAdminOwnershipStatusDto })
  @ApiOkResponse({ type: AdminOwnershipResponseDto })
  async updateStatus(
    @Req() req: any,
    @Body() body: UpdateAdminOwnershipStatusDto,
  ) {
    return this.adminOwnershipService.updateStatus(this.adminId(req), body);
  }
}