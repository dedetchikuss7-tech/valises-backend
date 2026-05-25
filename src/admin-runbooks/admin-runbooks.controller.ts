import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';

const RUNBOOKS = [
  {
    slug: 'payout-failure',
    title: 'Payout Failure',
    path: 'project-context/runbooks/payout-failure.md',
    severity: 'HIGH',
  },
  {
    slug: 'psp-outage',
    title: 'PSP Outage (CinetPay)',
    path: 'project-context/runbooks/psp-outage.md',
    severity: 'CRITICAL',
  },
  {
    slug: 'webhook-recovery',
    title: 'Webhook Recovery',
    path: 'project-context/runbooks/webhook-recovery.md',
    severity: 'HIGH',
  },
  {
    slug: 'reconciliation-mismatch',
    title: 'Reconciliation Mismatch',
    path: 'project-context/runbooks/reconciliation-mismatch.md',
    severity: 'HIGH',
  },
  {
    slug: 'fraud-escalation',
    title: 'Fraud Escalation',
    path: 'project-context/runbooks/fraud-escalation.md',
    severity: 'MEDIUM',
  },
];

@ApiTags('admin-runbooks')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('admin/runbooks')
export class AdminRunbooksController {
  @Get()
  @ApiOperation({ summary: 'List available operational runbooks' })
  list() {
    return { runbooks: RUNBOOKS };
  }
}
