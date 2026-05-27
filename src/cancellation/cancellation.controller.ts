import { Controller, Post, Param, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { CancellationService } from './cancellation.service';

@ApiTags('transactions-cancellation')
@ApiBearerAuth()
@Controller('transactions')
export class CancellationUserController {
  constructor(private readonly cancellationService: CancellationService) {}

  @Post(':id/cancel')
  @Roles('USER', 'ADMIN')
  @ApiOperation({ summary: 'Cancel a transaction (sender only, before IN_TRANSIT)' })
  async cancel(@Param('id') id: string, @Req() req: any) {
    return this.cancellationService.cancelTransaction(id, req.user.userId);
  }
}

@ApiTags('admin-transactions')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/transactions')
export class CancellationAdminController {
  constructor(private readonly cancellationService: CancellationService) {}

  @Post(':id/force-cancel')
  @ApiOperation({ summary: 'Force-cancel any transaction (admin, no status constraint except CANCELLED and DELIVERED)' })
  async forceCancel(@Param('id') id: string, @Req() req: any) {
    return this.cancellationService.forceCancelTransaction(id, req.user.userId);
  }
}
