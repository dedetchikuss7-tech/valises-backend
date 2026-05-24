## Lot #278 — KYC Provider (Smile ID + Webhook)

### Ce qui a été livré

- **Pattern provider KYC** : `KycProvider` abstract class + token `KYC_PROVIDER` (même pattern que `StorageProvider`)
- **`StripeIdentityProvider`** : logique Stripe extraite depuis `kyc.service.ts`, implémente `createVerificationSession`, `retrieveSession`, `verifyWebhookSignature`, `parseWebhookEvent`
- **`SmileIdProvider`** : nouveau provider pour CM/SN/CI (Smile ID Web Integration), HMAC-SHA256 webhook validation, mapping statuts APPROVED/REJECTED/EXPIRED/CANCELLED
- **`KycProviderModule`** : factory `KYC_PROVIDER` env-driven (`STRIPE_IDENTITY` par défaut, `SMILE_ID` si configuré)
- **`kyc.service.ts` refactoré** : injecte `IKycProvider`, délègue create/retrieve au provider, supprime méthodes privées Stripe, ajoute `handleKycWebhook()`
- **`POST /kyc/webhook`** : endpoint `@Public()` pour réception webhooks provider, vérification signature, mise à jour automatique `KycVerification` + `User.kycStatus`
- **Migration Prisma** : `SMILE_ID` ajouté à l'enum `KycProvider` (`20260524_add_smile_id_kyc_provider`)
- **Env validation** : `KYC_PROVIDER`, `SMILE_ID_PARTNER_ID`, `SMILE_ID_API_KEY`, `SMILE_ID_CALLBACK_URL` (requis si `KYC_PROVIDER=SMILE_ID`)

### Rétrocompatibilité

- `KYC_PROVIDER=STRIPE_IDENTITY` (défaut) : comportement identique à l'existant, aucune env var Smile ID requise
- Stripe Identity KYC non cassé — logique déplacée dans `StripeIdentityProvider`, pas supprimée

### Build & tests

- `npm run build` → 0 erreur
- `npm test` → 831 tests passent (816 avant + 15 nouveaux)

### Nouveaux tests

| Fichier | Tests |
|---|---|
| `stripe-identity.provider.spec.ts` | 5 (createVerificationSession, retrieveSession, verifyWebhookSignature) |
| `smile-id.provider.spec.ts` | 5 (API call, HMAC validation, status mapping) |
| `kyc.service.spec.ts` | +5 (handleKycWebhook: invalid sig → 401, ignored, verified update) |
