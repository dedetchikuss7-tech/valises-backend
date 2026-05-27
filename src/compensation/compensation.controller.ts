import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CompensationService } from './compensation.service';
import { UserRateLimitGuard, RateLimit } from '../common/rate-limiter/user-rate-limit.guard';
import { RateLimitedAction } from '../common/rate-limiter/user-rate-limiter.service';

@ApiTags('compensation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class CompensationController {
  constructor(private readonly compensationService: CompensationService) {}

  private userId(req: any): string {
    const id = req?.user?.userId;
    if (!id) {
      throw new UnauthorizedException('Missing auth (Bearer token required)');
    }
    return id;
  }

  @Roles('USER', 'ADMIN')
  @Post('compensation/request')
  @UseGuards(UserRateLimitGuard)
  @RateLimit(RateLimitedAction.CREATE_COMPENSATION)
  @ApiOperation({ summary: 'Submit a Protection Valises request' })
  async createRequest(
    @Body()
    body: {
      transactionId: string;
      type: 'LOST' | 'DAMAGED' | 'DELAYED';
      declaredValue?: number;
      description: string;
      evidenceUrls?: string[];
    },
    @Req() req: any,
  ) {
    return this.compensationService.createRequest({
      ...body,
      requestedById: this.userId(req),
    });
  }

  @Roles('USER', 'ADMIN')
  @Get('compensation/my-requests')
  @ApiOperation({ summary: 'Get own Protection Valises requests' })
  async getMyRequests(@Req() req: any) {
    return this.compensationService.getMyRequests(this.userId(req));
  }

  @Roles('ADMIN')
  @Get('admin/compensation/pending')
  @ApiOperation({ summary: 'List pending Protection Valises requests' })
  async getPending() {
    return this.compensationService.getPendingRequests();
  }

  @Roles('ADMIN')
  @Patch('admin/compensation/:id/review')
  @ApiOperation({ summary: 'Review a Protection Valises request' })
  async reviewRequest(
    @Param('id') id: string,
    @Body()
    body: {
      decision: 'APPROVED' | 'REJECTED' | 'UNDER_INVESTIGATION';
      adminNotes?: string;
      approvedAmount?: number;
    },
    @Req() req: any,
  ) {
    return this.compensationService.reviewRequest({
      compensationId: id,
      adminId: this.userId(req),
      ...body,
    });
  }
}
