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
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TrustService } from './trust.service';
import { RecordReputationEventDto } from './dto/record-reputation-event.dto';
import { RecordReputationEventResponseDto } from './dto/record-reputation-event-response.dto';
import { UserTrustProfileResponseDto } from './dto/user-trust-profile-response.dto';
import { ImposeBehaviorRestrictionDto } from './dto/impose-behavior-restriction.dto';
import { ImposeBehaviorRestrictionResponseDto } from './dto/impose-behavior-restriction-response.dto';
import { ReleaseBehaviorRestrictionDto } from './dto/release-behavior-restriction.dto';
import { ListBehaviorRestrictionsQueryDto } from './dto/list-behavior-restrictions-query.dto';
import { BehaviorRestrictionResponseDto } from './dto/behavior-restriction-response.dto';
import { BulkActionResultDto } from '../common/dto/bulk-action-result.dto';

@ApiTags('Trust')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trust')
export class TrustController {
  constructor(private readonly trustService: TrustService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Get('users/:userId/profile')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get one user trust profile',
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiOkResponse({
    type: UserTrustProfileResponseDto,
  })
  async getProfile(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.trustService.getProfile(userId);
  }

  @Post('users/:userId/events')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Record one reputation event',
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiBody({ type: RecordReputationEventDto })
  @ApiOkResponse({
    type: RecordReputationEventResponseDto,
  })
  async recordEvent(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: RecordReputationEventDto,
  ) {
    return this.trustService.recordEvent(userId, dto);
  }

  @Post('users/:userId/restrictions')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Impose one behavior restriction',
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiBody({ type: ImposeBehaviorRestrictionDto })
  @ApiOkResponse({
    type: ImposeBehaviorRestrictionResponseDto,
  })
  async imposeRestriction(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: ImposeBehaviorRestrictionDto,
    @Req() req: any,
  ) {
    return this.trustService.imposeRestriction(userId, dto, this.userId(req));
  }

  @Post('restrictions/:id/release')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Release one behavior restriction',
  })
  @ApiParam({ name: 'id', description: 'Behavior restriction UUID' })
  @ApiBody({ type: ReleaseBehaviorRestrictionDto })
  @ApiOkResponse({
    type: ImposeBehaviorRestrictionResponseDto,
  })
  async releaseRestriction(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReleaseBehaviorRestrictionDto,
    @Req() req: any,
  ) {
    return this.trustService.releaseRestriction(id, dto, this.userId(req));
  }

  @Post('restrictions/expire-due')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Expire due behavior restrictions',
    description:
      'Admin-only operational endpoint that marks ACTIVE restrictions as EXPIRED when their expiresAt timestamp is in the past, then refreshes affected trust profiles.',
  })
  @ApiOkResponse({
    type: BulkActionResultDto,
  })
  async expireDueRestrictions(@Req() req: any) {
    return this.trustService.expireDueRestrictions(this.userId(req));
  }

  @Get('restrictions')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List behavior restrictions',
  })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'kind', required: false, type: String })
  @ApiQuery({ name: 'scope', required: false, type: String })
  @ApiQuery({ name: 'expiredOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiOkResponse({
    type: BehaviorRestrictionResponseDto,
    isArray: true,
  })
  async listRestrictions(@Query() query: ListBehaviorRestrictionsQueryDto) {
    return this.trustService.listRestrictions(query);
  }
}