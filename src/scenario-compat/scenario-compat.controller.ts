import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ScenarioCompatService } from './scenario-compat.service';

@ApiTags('scenario-compat')
@Controller()
export class ScenarioCompatController {
  constructor(private readonly svc: ScenarioCompatService) {}

  // USERS
  @Post('users')
  @ApiOperation({ summary: '[Scenario compat] POST /users' })
  createUser(@Body() body: any) {
    return this.svc.createUser(body);
  }

  // KYC
  @Patch('kyc/users/:id/status')
  @ApiOperation({ summary: '[Scenario compat] PATCH /kyc/users/:id/status' })
  @ApiParam({ name: 'id' })
  updateKyc(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateKyc(id, body);
  }

  // TRANSACTIONS
  @Post('transactions')
  @ApiOperation({ summary: '[Scenario compat] POST /transactions' })
  createTx(@Body() body: any) {
    return this.svc.createTransaction(body);
  }

  @Patch('transactions/:id/payment/success')
  @ApiOperation({ summary: '[Scenario compat] PATCH /transactions/:id/payment/success' })
  @ApiParam({ name: 'id' })
  paymentSuccess(@Param('id') id: string) {
    const tx = this.svc.markPaymentSuccess(id);
    if (!tx) throw new NotFoundException('Transaction not found (scenario stub)');
    return tx;
  }

  @Patch('transactions/:id/status')
  @ApiOperation({ summary: '[Scenario compat] PATCH /transactions/:id/status' })
  @ApiParam({ name: 'id' })
  updateTxStatus(@Param('id') id: string, @Body() body: any) {
    const tx = this.svc.updateTxStatus(id, body);
    if (!tx) throw new NotFoundException('Transaction not found (scenario stub)');
    return tx;
  }

  @Get('transactions/:id/ledger')
  @ApiOperation({ summary: '[Scenario compat] GET /transactions/:id/ledger' })
  @ApiParam({ name: 'id' })
  ledger(@Param('id') id: string) {
    const l = this.svc.getLedger(id);
    if (!l) throw new NotFoundException('Transaction not found (scenario stub)');
    return l;
  }

  // DISPUTES
  @Post('disputes')
  @ApiOperation({ summary: '[Scenario compat] POST /disputes' })
  createDispute(@Body() body: any) {
    return this.svc.createDispute(body);
  }

  @Get('disputes/:id/recommendation')
  @ApiOperation({ summary: '[Scenario compat] GET /disputes/:id/recommendation' })
  @ApiParam({ name: 'id' })
  recommendation(@Param('id') id: string) {
    const rec = this.svc.getDisputeRecommendation(id);
    if (!rec) throw new NotFoundException('Dispute not found (scenario stub)');
    return rec;
  }

  @Patch('disputes/:id/resolve')
  @ApiOperation({ summary: '[Scenario compat] PATCH /disputes/:id/resolve' })
  @ApiParam({ name: 'id' })
  resolve(@Param('id') id: string, @Body() body: any) {
    const d = this.svc.resolveDispute(id, body);
    if (!d) throw new NotFoundException('Dispute not found (scenario stub)');
    return d;
  }
}