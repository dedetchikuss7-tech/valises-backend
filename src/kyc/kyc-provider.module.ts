import { Module } from '@nestjs/common';
import { KYC_PROVIDER, KycProvider } from './providers/kyc.provider';
import { StripeIdentityProvider } from './providers/stripe-identity.provider';
import { SmileIdProvider } from './providers/smile-id.provider';

@Module({
  providers: [
    {
      provide: KYC_PROVIDER,
      useFactory: (): KycProvider => {
        const providerName = process.env.KYC_PROVIDER ?? 'STRIPE_IDENTITY';
        if (providerName === 'SMILE_ID') {
          return new SmileIdProvider();
        }
        return new StripeIdentityProvider();
      },
    },
  ],
  exports: [KYC_PROVIDER],
})
export class KycProviderModule {}
