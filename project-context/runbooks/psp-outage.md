# Runbook — PSP Outage (CinetPay indisponible)

## Symptômes
- Erreurs 5xx ou timeouts sur tous les appels CinetPay
- Transactions bloquées à `status: CREATED` (paiements impossibles)
- Webhooks CinetPay absents depuis >30 min
- Alerte `/admin/operational-health` : transactions CREATED >24h

## Diagnostic
1. Vérifier le statut CinetPay : https://status.cinetpay.com
2. Tester manuellement un appel :
```bash
   curl -X POST https://api-checkout.cinetpay.com/v2/payment \
     -H "Content-Type: application/json" \
     -d '{"apikey":"TEST_KEY","site_id":"TEST_SITE"}'
```
3. Vérifier les logs Railway pour confirmer que c'est bien le PSP (pas notre code)

## Actions
### Pendant l'outage
1. Passer `PAYMENT_PROVIDER=MOCK` dans les variables Railway pour débloquer les nouveaux paiements en mode simulation
2. Notifier les utilisateurs actifs (message in-app si disponible)
3. Ne pas annuler les transactions CREATED — elles peuvent reprendre après retour PSP
4. Surveiller la file BullMQ : les webhooks en attente seront rejoués au retour

### Après retour du PSP
1. Remettre `PAYMENT_PROVIDER=CINETPAY`
2. Redéployer l'application (Railway → Deploy)
3. Déclencher la réconciliation manuelle :
   ```
   POST /admin/reconciliation/psp-runs
   { "dateFrom": "<outage_start>", "dateTo": "<outage_end>", "dryRun": true }
   ```
4. Vérifier les résultats : PSP_NOT_FOUND et PSP_STATUS_MISMATCH sur la période
5. Traiter chaque cas manuellement selon runbook `reconciliation-mismatch.md`

## Prévention
- Configurer une alerte Railway si aucun webhook CinetPay reçu depuis 1h
- Maintenir `PAYMENT_PROVIDER=MOCK` toujours fonctionnel pour basculement rapide
- Documenter les credentials MOCK dans un secret Railway séparé
