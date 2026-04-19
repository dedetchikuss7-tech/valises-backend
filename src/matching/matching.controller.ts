import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
      'Returns active, ticket-verified trip candidates for a package corridor, with filters, sorting, ranking breakdown, warnings, and proceedability signals.',
  })
  @ApiParam({ name: 'packageId', description: 'Package UUID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'minTravelerTrustScore', required: false, type: Number })
  @ApiQuery({ name: 'verifiedOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'withAvailableCapacityOnly', required: false, type: Boolean })
  @ApiQuery({ name: 'excludeRestricted', required: false, type: Boolean })
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
}