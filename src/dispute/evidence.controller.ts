import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { EvidenceService } from './evidence.service';
import { RequestEvidenceUploadDto } from './dto/evidence-upload.dto';

@ApiTags('Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('USER', 'ADMIN')
@Controller('disputes')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) throw new UnauthorizedException('Missing auth (Bearer token required)');
    return id;
  }

  @Post(':id/evidence/upload-url')
  @ApiOperation({ summary: 'Request a presigned URL to upload evidence for a dispute' })
  async requestUploadUrl(
    @Param('id') disputeId: string,
    @Body() dto: RequestEvidenceUploadDto,
    @Req() req: any,
  ) {
    return this.evidenceService.requestUploadUrl(disputeId, this.userId(req), dto);
  }

  @Get(':id/evidence')
  @ApiOperation({ summary: 'List evidence files for a dispute (with presigned download URLs)' })
  async getEvidenceList(
    @Param('id') disputeId: string,
    @Req() req: any,
  ) {
    return this.evidenceService.getEvidenceList(disputeId, this.userId(req));
  }
}
