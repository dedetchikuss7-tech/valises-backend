import {
  Body,
  Controller,
  Get,
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
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ReferralService } from './referral.service';
import { ApplyReferralDto } from './dto/apply-referral.dto';
import {
  ReferralCodeResponseDto,
  ReferralUseResponseDto,
} from './dto/referral-response.dto';

@ApiTags('Referral')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('referral')
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) throw new UnauthorizedException('Missing auth (Bearer token required)');
    return id;
  }

  @Get('my-code')
  @ApiOperation({ summary: 'Get or create my referral code' })
  @ApiOkResponse({ type: ReferralCodeResponseDto })
  async getMyCode(@Req() req: any) {
    return this.referralService.getMyCode(this.userId(req));
  }

  @Post('apply')
  @ApiOperation({ summary: 'Apply a referral code to my account' })
  @ApiBody({ type: ApplyReferralDto })
  @ApiOkResponse({ type: ReferralUseResponseDto })
  async applyReferral(@Body() dto: ApplyReferralDto, @Req() req: any) {
    return this.referralService.applyReferral(this.userId(req), dto.code);
  }

  @Get('my-referrals')
  @ApiOperation({ summary: 'List users I have referred' })
  @ApiOkResponse({ type: ReferralUseResponseDto, isArray: true })
  async getMyReferrals(@Req() req: any) {
    return this.referralService.getMyReferrals(this.userId(req));
  }
}
