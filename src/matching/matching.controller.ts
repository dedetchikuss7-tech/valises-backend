import {
  Body,
  Controller,
  Delete,
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
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { MatchingService } from './matching.service';
import {
  ListPackageTripCandidatesQueryDto,
  MatchSortOrder,
  MatchTripCandidatesSortBy,
} from './dto/list-package-trip-candidates-query.dto';
import { MatchTripCandidateResponseDto } from './dto/match-trip-candidate-response.dto';
import { UpsertPackageTripShortlistDto } from './dto/upsert-package-trip-shortlist.dto';
import { PackageTripShortlistResponseDto } from './dto/package-trip-shortlist-response.dto';

@ApiTags('Matching')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('matching')
export class MatchingController {
  constructor(private readonly matchingService: MatchingService) {}

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

  @Get('packages/:packageId/trip-candidates')
  @ApiOperation({
    summary: 'List ranked trip candidates for one package',
    description:
      'Returns active, ticket-verified trip candidates for a package corridor, with filters, sorting, ranking breakdown, warnings, shortlist visibility, and proceedability signals.',
  })
  @ApiParam({ name: 'packageId', description: 'Package UUID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'minTravelerTrustScore', required: false, type: Number })
  @ApiQuery({ name: 'verifiedOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'withAvailableCapacityOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'excludeRestricted', required: false, type: Boolean })
  @ApiQuery({ name: 'shortlistedOnly', required: false, type: Boolean })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: MatchTripCandidatesSortBy,
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: MatchSortOrder,
  })
  @ApiOkResponse({
    description: 'Ranked trip candidates for the package',
    type: MatchTripCandidateResponseDto,
    isArray: true,
  })
  async listTripCandidatesForPackage(
    @Req() req: any,
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Query() query: ListPackageTripCandidatesQueryDto,
  ) {
    return this.matchingService.listTripCandidatesForPackage(
      packageId,
      this.userId(req),
      this.userRole(req),
      query,
    );
  }

  @Get('packages/:packageId/shortlist')
  @ApiOperation({
    summary: 'List sender shortlist for one package',
    description:
      'Returns the sender shortlist entries for a package with current trip and traveler summaries.',
  })
  @ApiParam({ name: 'packageId', description: 'Package UUID' })
  @ApiOkResponse({
    description: 'Shortlisted trip candidates for the package',
    type: PackageTripShortlistResponseDto,
    isArray: true,
  })
  async listShortlistForPackage(
    @Req() req: any,
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
  ) {
    return this.matchingService.listShortlistForPackage(
      packageId,
      this.userId(req),
      this.userRole(req),
    );
  }

  @Post('packages/:packageId/trips/:tripId/shortlist')
  @ApiOperation({
    summary: 'Shortlist or reprioritize one trip candidate for a package',
    description:
      'Creates or updates a sender shortlist entry for a package/trip pair, with sender priority and optional note.',
  })
  @ApiParam({ name: 'packageId', description: 'Package UUID' })
  @ApiParam({ name: 'tripId', description: 'Trip UUID' })
  @ApiBody({ type: UpsertPackageTripShortlistDto })
  @ApiOkResponse({
    description: 'Created or updated shortlist entry',
    type: PackageTripShortlistResponseDto,
  })
  async shortlistTripForPackage(
    @Req() req: any,
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
    @Body() body: UpsertPackageTripShortlistDto,
  ) {
    return this.matchingService.shortlistTripForPackage(
      packageId,
      tripId,
      this.userId(req),
      this.userRole(req),
      body,
    );
  }

  @Delete('packages/:packageId/trips/:tripId/shortlist')
  @ApiOperation({
    summary: 'Remove one trip candidate from sender shortlist',
    description:
      'Deletes a sender shortlist entry for a package/trip pair if it exists.',
  })
  @ApiParam({ name: 'packageId', description: 'Package UUID' })
  @ApiParam({ name: 'tripId', description: 'Trip UUID' })
  @ApiOkResponse({
    description: 'Shortlist removal result',
    schema: {
      example: {
        packageId: 'pkg-id',
        tripId: 'trip-id',
        removed: true,
      },
    },
  })
  async removeShortlistedTripForPackage(
    @Req() req: any,
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
    @Param('tripId', new ParseUUIDPipe()) tripId: string,
  ) {
    return this.matchingService.removeShortlistedTripForPackage(
      packageId,
      tripId,
      this.userId(req),
      this.userRole(req),
    );
  }
}