import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ConfirmEvidenceUploadDto } from './dto/confirm-evidence-upload.dto';
import { EvidenceAttachmentResponseDto } from './dto/evidence-attachment-response.dto';
import { EvidenceUploadConfirmationService } from './evidence-upload-confirmation.service';

@ApiTags('Evidence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evidence/attachments')
export class EvidenceUploadConfirmationController {
  constructor(
    private readonly evidenceUploadConfirmationService: EvidenceUploadConfirmationService,
  ) {}

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

  @Post('confirm-upload')
  @ApiOperation({
    summary: 'Confirm evidence upload and create attachment',
    description:
      'Confirms a previously prepared storage upload using the existing StorageProvider, then creates an EvidenceAttachment with the confirmed storage metadata.',
  })
  @ApiBody({ type: ConfirmEvidenceUploadDto })
  @ApiOkResponse({ type: EvidenceAttachmentResponseDto })
  confirmUpload(@Req() req: any, @Body() dto: ConfirmEvidenceUploadDto) {
    return this.evidenceUploadConfirmationService.confirmUploadAndCreateAttachment(
      this.userId(req),
      this.userRole(req),
      dto,
    );
  }
}