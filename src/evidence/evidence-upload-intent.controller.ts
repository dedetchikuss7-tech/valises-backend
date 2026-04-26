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
import { CreateEvidenceUploadIntentDto } from './dto/create-evidence-upload-intent.dto';
import { EvidenceUploadIntentResponseDto } from './dto/evidence-upload-intent-response.dto';
import { EvidenceUploadIntentService } from './evidence-upload-intent.service';

@ApiTags('Evidence Upload Intents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evidence/upload-intents')
export class EvidenceUploadIntentController {
  constructor(
    private readonly evidenceUploadIntentService: EvidenceUploadIntentService,
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

  @Post()
  @ApiOperation({
    summary: 'Create evidence upload intent',
    description:
      'Creates a controlled upload intent for a future evidence attachment using the existing StorageProvider abstraction. This does not upload binary files.',
  })
  @ApiBody({ type: CreateEvidenceUploadIntentDto })
  @ApiOkResponse({ type: EvidenceUploadIntentResponseDto })
  create(@Req() req: any, @Body() dto: CreateEvidenceUploadIntentDto) {
    return this.evidenceUploadIntentService.createUploadIntent(
      this.userId(req),
      this.userRole(req),
      dto,
    );
  }
}