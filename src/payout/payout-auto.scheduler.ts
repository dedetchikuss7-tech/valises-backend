import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PayoutAutoService } from './payout-auto.service';

@Injectable()
export class PayoutAutoScheduler {
  private readonly logger = new Logger(PayoutAutoScheduler.name);

  constructor(private readonly payoutAutoService: PayoutAutoService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runNightlyEligibilityBatch() {
    this.logger.log('Starting nightly payout eligibility batch');
    const result = await this.payoutAutoService.markEligibleBatch();
    this.logger.log(`Nightly batch complete: ${JSON.stringify(result)}`);
  }
}
