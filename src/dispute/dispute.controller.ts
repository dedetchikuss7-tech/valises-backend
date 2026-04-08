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
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ConfirmDisputeEvidenceUploadDto } from './dto/confirm-dispute-evidence-upload.dto';
import { CreateDisputeCaseNoteDto } from './dto/create-dispute-case-note.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { CreateDisputeEvidenceItemDto } from './dto/create-dispute-evidence-item.dto';
import { CreateDisputeEvidenceUploadIntentDto } from './dto/create-dispute-evidence-upload-intent.dto';
import { GetDisputeRecommendationDto } from './dto/get-dispute-recommendation.dto';
import { InvalidateDisputeEvidenceItemDto } from './dto/invalidate-dispute-evidence-item.dto';
import { ListDisputesQueryDto } from './dto/list-disputes-query.dto';
import { ResetDisputeEvidenceItemReviewDto } from './dto/reset-dispute-evidence-item-review.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { ReviewDisputeEvidenceItemDto } from './dto/review-dispute-evidence-item.dto';
import { UpdateDisputeAdminDossierDto } from './dto/update-dispute-admin-dossier.dto';
import { DisputeService } from './dispute.service';

@ApiTags('Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('disputes')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

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

  @Post()
  @ApiOperation({
    summary: 'Open a dispute',
    description:
      'Authenticated endpoint opening a dispute for a transaction. openedById is always taken from the JWT user. opening metadata is inferred and stored structurally.',
  })
  @ApiBody({ type: CreateDisputeDto })
  async create(@Req() req: any, @Body() body: CreateDisputeDto) {
    return this.disputeService.create({
      transactionId: body.transactionId,
      openedById: this.userId(req),
      actorRole: this.userRole(req),
      reason: body.reason,
      reasonCode: body.reasonCode,
    });
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'List disputes',
    description:
      'Admin-only endpoint returning disputes with linked resolution, money-flow context, structured opening metadata filters, advanced evidence filters, and upload state signals.',
  })
  async findAll(@Query() query: ListDisputesQueryDto) {
    return this.disputeService.findAll(query);
  }

  @Get(':id')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get one dispute',
    description:
      'Admin-only endpoint returning one dispute with its linked resolution, transaction context, admin dossier fields, case notes, evidence items, admin summary, and upload lifecycle signals.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  async findOne(@Param('id') id: string) {
    return this.disputeService.findOne(id);
  }

  @Post(':id/notes')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Add an internal admin case note',
    description:
      'Admin-only endpoint adding a timestamped internal note to a dispute dossier.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiBody({ type: CreateDisputeCaseNoteDto })
  async addCaseNote(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: CreateDisputeCaseNoteDto,
  ) {
    return this.disputeService.addCaseNote(id, this.userId(req), body);
  }

  @Patch(':id/admin-dossier')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Update lightweight admin dossier fields',
    description:
      'Admin-only endpoint updating structured dossier fields such as statements, evidence summary, admin assessment, and evidence status.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiBody({ type: UpdateDisputeAdminDossierDto })
  async updateAdminDossier(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: UpdateDisputeAdminDossierDto,
  ) {
    return this.disputeService.updateAdminDossier(id, this.userId(req), body);
  }

  @Post(':id/evidence-items')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Add dispute evidence item metadata',
    description:
      'Admin-only endpoint adding a referenced evidence item to the dispute dossier.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiBody({ type: CreateDisputeEvidenceItemDto })
  async addEvidenceItem(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: CreateDisputeEvidenceItemDto,
  ) {
    return this.disputeService.addEvidenceItem(id, this.userId(req), body);
  }

  @Post(':id/evidence-upload-intents')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Prepare an upload-ready evidence item',
    description:
      'Admin-only endpoint generating a normalized pending storageKey and backend constraints for a future file upload flow.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiBody({ type: CreateDisputeEvidenceUploadIntentDto })
  async createEvidenceUploadIntent(
    @Param('id') id: string,
    @Req() req: any,
    @Body() body: CreateDisputeEvidenceUploadIntentDto,
  ) {
    return this.disputeService.createEvidenceUploadIntent(
      id,
      this.userId(req),
      body,
    );
  }

  @Patch(':id/evidence-items/:evidenceItemId/confirm-upload')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Confirm dispute evidence upload',
    description:
      'Admin-only endpoint confirming that an upload-ready evidence item has actually been uploaded and is now available for review.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiParam({ name: 'evidenceItemId', description: 'Dispute evidence item ID' })
  @ApiBody({ type: ConfirmDisputeEvidenceUploadDto })
  async confirmEvidenceUpload(
    @Param('id') id: string,
    @Param('evidenceItemId') evidenceItemId: string,
    @Req() req: any,
    @Body() body: ConfirmDisputeEvidenceUploadDto,
  ) {
    return this.disputeService.confirmEvidenceUpload(
      id,
      evidenceItemId,
      this.userId(req),
      body,
    );
  }

  @Patch(':id/evidence-items/:evidenceItemId/review')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Review dispute evidence item',
    description:
      'Admin-only endpoint accepting or rejecting an evidence item with optional rejection reason.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiParam({ name: 'evidenceItemId', description: 'Dispute evidence item ID' })
  @ApiBody({ type: ReviewDisputeEvidenceItemDto })
  async reviewEvidenceItem(
    @Param('id') id: string,
    @Param('evidenceItemId') evidenceItemId: string,
    @Req() req: any,
    @Body() body: ReviewDisputeEvidenceItemDto,
  ) {
    return this.disputeService.reviewEvidenceItem(
      id,
      evidenceItemId,
      this.userId(req),
      body,
    );
  }

  @Patch(':id/evidence-items/:evidenceItemId/reset-review')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Reset dispute evidence item review',
    description:
      'Admin-only endpoint moving an evidence item back to PENDING review state.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiParam({ name: 'evidenceItemId', description: 'Dispute evidence item ID' })
  @ApiBody({ type: ResetDisputeEvidenceItemReviewDto })
  async resetEvidenceItemReview(
    @Param('id') id: string,
    @Param('evidenceItemId') evidenceItemId: string,
    @Req() req: any,
    @Body() body: ResetDisputeEvidenceItemReviewDto,
  ) {
    return this.disputeService.resetEvidenceItemReview(
      id,
      evidenceItemId,
      this.userId(req),
      body,
    );
  }

  @Patch(':id/evidence-items/:evidenceItemId/invalidate')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Invalidate dispute evidence item',
    description:
      'Admin-only endpoint force-invalidating an evidence item with a required reason.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiParam({ name: 'evidenceItemId', description: 'Dispute evidence item ID' })
  @ApiBody({ type: InvalidateDisputeEvidenceItemDto })
  async invalidateEvidenceItem(
    @Param('id') id: string,
    @Param('evidenceItemId') evidenceItemId: string,
    @Req() req: any,
    @Body() body: InvalidateDisputeEvidenceItemDto,
  ) {
    return this.disputeService.invalidateEvidenceItem(
      id,
      evidenceItemId,
      this.userId(req),
      body,
    );
  }

  @Get(':id/recommendation')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Get dispute recommendation',
    description:
      'Admin-only endpoint returning the matrix recommendation for a dispute based on reason, evidence level, and delivery context.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  async recommendation(
    @Param('id') id: string,
    @Query() query: GetDisputeRecommendationDto,
  ) {
    return this.disputeService.getRecommendation(id, query);
  }

  @Patch(':id/resolve')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Resolve dispute',
    description:
      'Admin-only endpoint resolving a dispute and orchestrating payout/refund flows when applicable.',
  })
  @ApiParam({ name: 'id', description: 'Dispute ID' })
  @ApiBody({ type: ResolveDisputeDto })
  async resolve(@Param('id') id: string, @Body() body: ResolveDisputeDto) {
    return this.disputeService.resolve(id, body);
  }
}