import { Controller, Delete, Get, Param, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../auth/roles.decorator';
import { DocumentLifecycleService } from './document-lifecycle.service';

@ApiTags('document-lifecycle')
@ApiBearerAuth()
@Controller()
export class DocumentLifecycleController {
  constructor(private readonly service: DocumentLifecycleService) {}

  /**
   * User: initiates soft deletion of personal data (grace period 30 days).
   * Financial records (ledger, transactions, payouts, disputes) are NOT deleted.
   */
  @Delete('me/data')
  async requestDeletion(@Request() req: any) {
    return this.service.requestDataDeletion(req.user.userId);
  }

  /**
   * Admin: audit trail of document accesses for a given user.
   */
  @Roles(Role.ADMIN)
  @Get('admin/document-access-logs/:userId')
  async getAccessLogs(@Param('userId') userId: string) {
    return this.service.getDocumentAccessLogs(userId);
  }
}
