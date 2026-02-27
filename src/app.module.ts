import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// ... tes imports existants (Auth, Users, Transactions, etc.)
import { KycModule } from './kyc/kyc.module';
import { ScenarioCompatModule } from './scenario-compat/scenario-compat.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // ... tes modules existants

    KycModule,
    ScenarioCompatModule,
  ],
})
export class AppModule {}