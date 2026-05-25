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
import { Public } from '../auth/public.decorator';
import { MobileContractService } from './mobile-contract.service';
import { MobileContractResponseDto } from './dto/mobile-contract-response.dto';

@ApiTags('Mobile Contract')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mobile')
export class MobileContractController {
  constructor(private readonly mobileContractService: MobileContractService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Get('mobile-contract/v2')
  @Public()
  @ApiOperation({ summary: 'Mobile contract V2 — full endpoint reference for FlutterFlow' })
  getContractV2() {
    return this.mobileContractService.getContractV2();
  }

  @Get('me/contract')
  @ApiOperation({
    summary: 'Get the current mobile/backend contract for the authenticated user',
    description:
      'Returns a stable mobile-friendly contract snapshot combining user identity, KYC summary, trust profile, active restrictions, derived capabilities, and global legal acceptance summary.',
  })
  @ApiOkResponse({
    description: 'Mobile contract snapshot for the authenticated user',
    type: MobileContractResponseDto,
  })
  async getMyContract(@Req() req: any) {
    return this.mobileContractService.getMyContract(this.userId(req));
  }
}