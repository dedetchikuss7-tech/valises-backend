import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CurrencyRateService } from './currency-rate.service';
import { CurrenciesController } from './currencies.controller';

@Module({
  imports: [ConfigModule],
  controllers: [CurrenciesController],
  providers: [CurrencyRateService],
  exports: [CurrencyRateService],
})
export class CurrenciesModule {}
