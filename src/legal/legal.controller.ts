import {
  Body,
  Controller,
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
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LegalService } from './legal.service';
import { RecordLegalAcceptanceDto } from './dto/record-legal-acceptance.dto';
import { LegalAcceptanceResponseDto } from './dto/legal-acceptance-response.dto';
import { ListLegalAcceptancesQueryDto } from './dto/list-legal-acceptances-query.dto';

@ApiTags('Legal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

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

  @Post('acceptances/me')
  @ApiOperation({
    summary: 'Record one legal acceptance for the authenticated user',
    description:
      'Creates or reuses a legal/product acceptance record for the authenticated user.',
  })
  @ApiBody({ type: RecordLegalAcceptanceDto })
  @ApiOkResponse({
    description: 'Recorded or reused legal acceptance',
    type: LegalAcceptanceResponseDto,
  })
  async recordMyAcceptance(
    @Req() req: any,
    @Body() dto: RecordLegalAcceptanceDto,
  ) {
    return this.legalService.recordAcceptance(this.userId(req), dto);
  }

  @Get('acceptances/me')
  @ApiOperation({
    summary: 'List my legal acceptances',
    description:
      'Returns legal/product acceptances recorded for the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Legal acceptances of the authenticated user',
    type: LegalAcceptanceResponseDto,
    isArray: true,
  })
  async listMyAcceptances(@Req() req: any) {
    return this.legalService.listMyAcceptances(this.userId(req));
  }

  @Get('acceptances')
  @Roles('ADMIN')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'List legal acceptances',
    description:
      'Admin-only endpoint listing legal/product acceptances with optional filters.',
  })
  @ApiQuery({ name: 'documentType', required: false, type: String })
  @ApiQuery({ name: 'context', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'transactionId', required: false, type: String })
  @ApiQuery({ name: 'packageId', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiOkResponse({
    description: 'Legal acceptances',
    type: LegalAcceptanceResponseDto,
    isArray: true,
  })
  async listAcceptances(@Query() query: ListLegalAcceptancesQueryDto) {
    return this.legalService.listAcceptances(query);
  }

  @Post('transactions/:transactionId/acknowledge-platform-role')
  @ApiOperation({
    summary: 'Acknowledge limited platform role for one transaction',
    description:
      'Records that the authenticated actor acknowledged the platform role limitations on a given transaction.',
  })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiOkResponse({
    description: 'Recorded platform role acknowledgment',
    type: LegalAcceptanceResponseDto,
  })
  async acknowledgeTransactionPlatformRole(
    @Req() req: any,
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.legalService.acknowledgeTransactionPlatformRole(
      this.userId(req),
      this.userRole(req),
      transactionId,
    );
  }

  @Post('transactions/:transactionId/acknowledge-delivery-risk')
  @ApiOperation({
    summary: 'Acknowledge delivery/remise risk notice for one transaction',
    description:
      'Records that the authenticated actor acknowledged the practical handover/delivery risk notice on a given transaction.',
  })
  @ApiParam({ name: 'transactionId', description: 'Transaction UUID' })
  @ApiOkResponse({
    description: 'Recorded delivery risk acknowledgment',
    type: LegalAcceptanceResponseDto,
  })
  async acknowledgeTransactionDeliveryRisk(
    @Req() req: any,
    @Param('transactionId', new ParseUUIDPipe()) transactionId: string,
  ) {
    return this.legalService.acknowledgeTransactionDeliveryRisk(
      this.userId(req),
      this.userRole(req),
      transactionId,
    );
  }

  @Post('packages/:packageId/acknowledge-rules')
  @ApiOperation({
    summary: 'Acknowledge package rules notice',
    description:
      'Records that the authenticated actor acknowledged the package/prohibited-items legal-product notice on a package.',
  })
  @ApiParam({ name: 'packageId', description: 'Package UUID' })
  @ApiOkResponse({
    description: 'Recorded package rules acknowledgment',
    type: LegalAcceptanceResponseDto,
  })
  async acknowledgePackageRules(
    @Req() req: any,
    @Param('packageId', new ParseUUIDPipe()) packageId: string,
  ) {
    return this.legalService.acknowledgePackageRules(
      this.userId(req),
      this.userRole(req),
      packageId,
    );
  }
}