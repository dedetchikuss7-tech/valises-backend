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
import { ListPackageTripCandidatesQueryDto } from './dto/list-package-trip-candidates-query.dto';
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
      'Returns active, ticket-verified trip candidates for a package corridor, ranked using KYC, trust profile, restrictions, and capacity fit.',
  })
  @ApiParam({ name: 'packageId', description: 'Package UUID' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
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
      query.limit ?? 20,
    );
  }
}