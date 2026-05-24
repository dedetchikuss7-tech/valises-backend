import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
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
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Public } from '../auth/public.decorator';
import { KycService } from './kyc.service';
import { UpdateKycStatusDto } from './dto/update-kyc-status.dto';
import { CreateKycSessionResponseDto } from './dto/create-kyc-session-response.dto';
import { KycMeResponseDto } from './dto/kyc-me-response.dto';
import { SyncKycVerificationResponseDto } from './dto/sync-kyc-verification-response.dto';

@ApiTags('KYC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

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

  @Get('me')
  @ApiOperation({
    summary: 'Get my KYC status',
    description:
      'Returns the current authenticated user KYC status and the latest local verification attempt when one exists.',
  })
  @ApiOkResponse({
    description: 'Current KYC state for the authenticated user',
    type: KycMeResponseDto,
  })
  async getMyKyc(@Req() req: any) {
    return this.kyc.getMyKyc(this.userId(req));
  }

  @Post('me/session')
  @ApiOperation({
    summary: 'Create a KYC verification session',
    description:
      'Creates a new KYC verification session for the authenticated user using the configured provider, marks KYC as PENDING, and returns the hosted verification URL.',
  })
  @ApiOkResponse({
    description: 'Created KYC verification session',
    type: CreateKycSessionResponseDto,
  })
  async createMyKycSession(@Req() req: any) {
    return this.kyc.createVerificationSession(this.userId(req));
  }

  @Post('verifications/:id/sync')
  @ApiOperation({
    summary: 'Synchronize one KYC verification from the provider',
    description:
      'Retrieves the verification session from the active KYC provider and updates the local verification status plus the user KYC status.',
  })
  @ApiParam({ name: 'id', description: 'Local KYC verification ID' })
  @ApiOkResponse({
    description: 'Synchronized KYC verification result',
    type: SyncKycVerificationResponseDto,
  })
  async syncVerification(@Req() req: any, @Param('id') id: string) {
    return this.kyc.syncVerification(id, this.userId(req), this.userRole(req));
  }

  @Post('webhook')
  @Public()
  @ApiOperation({
    summary: 'KYC provider webhook receiver',
    description:
      'Receives webhook events from the configured KYC provider (Stripe Identity or Smile ID) and automatically updates verification and user KYC status.',
  })
  async handleKycWebhook(
    @Body() body: unknown,
    @Headers() headers: Record<string, string>,
  ) {
    return this.kyc.handleKycWebhook(body, headers);
  }

  @Patch('users/:id/status')
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'Manually update user KYC status',
    description:
      'Admin-only endpoint used for fallback manual review or operational override.',
  })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateKycStatusDto })
  async updateUserKycStatus(
    @Param('id') id: string,
    @Body() body: UpdateKycStatusDto,
  ) {
    return this.kyc.setUserKycStatus(id, body.kycStatus);
  }
}
