import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { CurrencyRateService } from './currency-rate.service';

@ApiTags('currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currencyRateService: CurrencyRateService) {}

  @Get('rates')
  @Public()
  @ApiOperation({
    summary: 'Indicative XAF exchange rates (cached 1h, graceful fallback)',
  })
  async getRates() {
    return this.currencyRateService.getRates();
  }
}
