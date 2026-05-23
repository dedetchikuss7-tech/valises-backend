import {
  Controller,
  Get,
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
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OnboardingService } from './onboarding.service';
import { OnboardingStatusResponseDto } from './dto/onboarding-status-response.dto';

@ApiTags('Onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get onboarding status for the authenticated user',
    description:
      'Returns KYC status, step completion, readiness to transact, and any blocking reasons.',
  })
  @ApiOkResponse({
    description: 'Onboarding status for the authenticated user',
    type: OnboardingStatusResponseDto,
  })
  async getStatus(@Req() req: any): Promise<OnboardingStatusResponseDto> {
    return this.onboardingService.getStatus(this.userId(req));
  }
}
