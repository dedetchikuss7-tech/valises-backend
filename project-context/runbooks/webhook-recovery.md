# Runbook — Webhook Recovery (webhooks manqués)

## Symptômes
- Transactions PAID côté PSP mais toujours CREATED dans notre base
- Paiements confirmés par les users mais non reflétés dans l'app
- Alerte `/admin/operational-health` : transactions CREATED >24h
- Logs Railway : erreurs dans WebhookWorker ou WebhookController

## Diagnostic
1. Vérifier la table `ProviderEvent` pour les webhooks reçus :
```sql
   SELECT id, provider, eventType, status, createdAt
   FROM "ProviderEvent"
   WHERE status = 'FAILED'
   ORDER BY "createdAt" DESC
   LIMIT 20;
```
2. Vérifier si `WEBHOOK_ASYNC_ENABLED=true` — si oui, inspecter la queue BullMQ
3. Vérifier les logs Railway pour les erreurs HMAC (webhook rejeté pour signature invalide)
4. Vérifier si `PROVIDER_WEBHOOK_SECRET_CINETPAY` est correct dans Railway

## Actions
### Rejouer un webhook spécifique
Utiliser l'endpoint admin de resend existant :
```
POST /admin/support/webhooks/:providerEventId/resend
```

### Rejouer en masse (après outage)
1. Identifier la période concernée dans `ProviderEvent` WHERE status = 'FAILED'
2. Appeler le resend pour chaque event concerné
3. Surveiller les logs pour confirmer le traitement

### Si webhook jamais reçu (PSP ne l'a pas envoyé)
1. Déclencher une réconciliation PSP sur la période :
   ```
   POST /admin/reconciliation/psp-runs
   { "dryRun": true }
   ```
2. Pour chaque PSP_STATUS_MISMATCH identifié, mettre à jour manuellement la transaction

### Si erreur HMAC systématique
1. Vérifier que `PROVIDER_WEBHOOK_SECRET_CINETPAY` dans Railway correspond au secret configuré dans le dashboard CinetPay
2. Redéployer après correction du secret
3. Rejouer les webhooks FAILED

## Prévention
- Activer `WEBHOOK_ASYNC_ENABLED=true` en production pour isolation des erreurs
- Surveiller la queue BullMQ via `/admin/operational-health`
- Configurer une alerte sur les `ProviderEvent` FAILED >5 en 1h
