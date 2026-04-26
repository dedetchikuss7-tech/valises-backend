import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EvidenceService } from './evidence.service';
import { EvidenceAdminSummaryResponseDto } from './dto/evidence-admin-summary-response.dto';
import { ListEvidenceAdminReviewQueueQueryDto } from './dto/list-evidence-admin-review-queue-query.dto';

@ApiTags('Evidence Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evidence/admin')
export class EvidenceAdminController {
  constructor(private readonly evidenceService: EvidenceService) {}

  private userRole(req: any): Role {
    const role = req?.user?.role;
    if (!role) {
      throw new UnauthorizedException('Missing auth role');
    }
    return role as Role;
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get evidence admin summary',
    description:
      'Admin-only summary of evidence attachment counts by review status, visibility and target type.',
  })
  @ApiOkResponse({ type: EvidenceAdminSummaryResponseDto })
  getSummary(@Req() req: any) {
    return this.evidenceService.getAdminSummary(this.userRole(req));
  }

  @Get('review-queue')
  @ApiOperation({
    summary: 'List evidence admin review queue',
    description:
      'Admin-only review queue for evidence attachments. Defaults to PENDING_REVIEW.',
  })
  listReviewQueue(
    @Req() req: any,
    @Query() query: ListEvidenceAdminReviewQueueQueryDto,
  ) {
    return this.evidenceService.listAdminReviewQueue(this.userRole(req), query);
  }
}