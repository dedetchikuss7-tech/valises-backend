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
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { EvidenceService } from './evidence.service';
import { CreateEvidenceAttachmentDto } from './dto/create-evidence-attachment.dto';
import { EvidenceAttachmentResponseDto } from './dto/evidence-attachment-response.dto';
import { ListEvidenceAttachmentsQueryDto } from './dto/list-evidence-attachments-query.dto';
import { ReviewEvidenceAttachmentDto } from './dto/review-evidence-attachment.dto';

@ApiTags('Evidence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evidence/attachments')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

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
    summary: 'Create evidence attachment reference',
    description:
      'Creates a metadata/reference record for evidence. The target object must exist and the actor must be allowed to attach evidence to it. Real file upload/storage is not implemented in this lot.',
  })
  @ApiBody({ type: CreateEvidenceAttachmentDto })
  @ApiOkResponse({ type: EvidenceAttachmentResponseDto })
  create(@Req() req: any, @Body() dto: CreateEvidenceAttachmentDto) {
    return this.evidenceService.create(
      this.userId(req),
      this.userRole(req),
      dto,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'List evidence attachment references',
    description:
      'Admins can list all evidence references. Normal users can list their own uploaded references, or references for a target they are allowed to access.',
  })
  list(@Req() req: any, @Query() query: ListEvidenceAttachmentsQueryDto) {
    return this.evidenceService.list(
      this.userId(req),
      this.userRole(req),
      query,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get one evidence attachment reference',
  })
  @ApiParam({ name: 'id', description: 'Evidence attachment ID' })
  @ApiOkResponse({ type: EvidenceAttachmentResponseDto })
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.evidenceService.getOne(
      this.userId(req),
      this.userRole(req),
      id,
    );
  }

  @Patch(':id/review')
  @ApiOperation({
    summary: 'Admin review evidence attachment',
  })
  @ApiParam({ name: 'id', description: 'Evidence attachment ID' })
  @ApiBody({ type: ReviewEvidenceAttachmentDto })
  @ApiOkResponse({ type: EvidenceAttachmentResponseDto })
  review(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: ReviewEvidenceAttachmentDto,
  ) {
    return this.evidenceService.review(
      this.userId(req),
      this.userRole(req),
      id,
      dto,
    );
  }
}