# Runbook — Payout Failure

## Symptômes
- Payout avec `status: FAILED` dans la base
- Alerte `/admin/operational-health` : payouts FAILED dans les 24h
- Le voyageur signale ne pas avoir reçu son argent

## Diagnostic
1. Récupérer le payout concerné :
```sql
   SELECT id, status, userId, amount, failureReason, updatedAt
   FROM "Payout"
   WHERE status = 'FAILED'
   ORDER BY "updatedAt" DESC
   LIMIT 10;
```
2. Vérifier `failureReason` : timeout PSP, fonds insuffisants, compte invalide ?
3. Vérifier les logs Railway pour l'erreur PSP exacte (timestamp du FAILED)
4. Vérifier si le PSP CinetPay est opérationnel : https://status.cinetpay.com

## Actions
### Si erreur temporaire PSP (5xx, timeout)
1. Attendre 15 min et vérifier si le PSP est revenu
2. Déclencher une re-tentative manuelle via `PayoutService.approvePayout(payoutId, adminId)`
3. Surveiller le statut dans les 10 min suivantes

### Si compte du voyageur invalide (numéro mobile money erroné)
1. Contacter le voyageur pour corriger ses coordonnées de paiement
2. Mettre le payout en statut PENDING manuellement après correction
3. Re-déclencher l'approbation

### Si fonds insuffisants (escrow vide)
1. Vérifier l'intégrité du ledger : `GET /admin-finance/balance-mismatches`
2. Escalader immédiatement au CTO — ne pas tenter de correction manuelle

## Prévention
- Surveiller `/admin/operational-health` quotidiennement
- Activer les alertes Railway sur les logs contenant "PAYOUT FAILED"
- Valider les coordonnées mobile money au moment de l'inscription du voyageur
