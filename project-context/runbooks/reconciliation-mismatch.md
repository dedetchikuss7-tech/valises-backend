# Runbook — Reconciliation Mismatch

## Symptômes
- ReconciliationCase avec severity CRITICAL ou HIGH dans la base
- Résultat de `POST /admin/reconciliation/psp-runs` contient des discrepancies
- Payout bloqué en attente de résolution d'un mismatch

## Types de cas et actions

### PSP_NOT_FOUND (CRITICAL)
**Situation :** Transaction marquée PAID dans notre base, introuvable chez CinetPay.

Actions :
1. Vérifier le `payinProviderReference` de la transaction — format attendu : `payin:{transactionId}`
2. Chercher dans le dashboard CinetPay avec le montant et la date
3. Si introuvable après 48h : ouvrir un ticket CinetPay avec les détails
4. **Ne pas déclencher le payout** tant que non résolu
5. Marquer le ReconciliationCase avec un adminNote expliquant l'investigation

### PSP_STATUS_MISMATCH (CRITICAL)
**Situation :** Statut différent entre notre base et CinetPay (ex: PAID chez nous, FAILED chez PSP).

Actions :
1. Le PSP est source de vérité — si CinetPay dit FAILED, notre transaction est probablement incorrecte
2. Vérifier les logs du webhook original pour comprendre pourquoi le statut a divergé
3. Si CinetPay confirme le paiement : mettre à jour notre statut via admin
4. Si CinetPay confirme l'échec : annuler la transaction et rembourser l'escrow
5. **Geler le payout** associé immédiatement

### AMOUNT_MISMATCH (HIGH)
**Situation :** Montant différent entre notre base et CinetPay.

Actions :
1. Vérifier si la différence correspond à des frais PSP non anticipés
2. Vérifier le `commissionAmount` de la transaction
3. Si écart injustifié >100 XAF : escalader au CTO
4. Documenter la décision dans adminNote du ReconciliationCase

## Workflow de résolution
1. Lancer en dryRun d'abord : `{ "dryRun": true }`
2. Analyser les cases créés
3. Traiter CRITICAL en priorité dans les 24h
4. Traiter HIGH dans les 72h
5. Marquer chaque case résolu une fois l'action effectuée

## Prévention
- Lancer une réconciliation hebdomadaire même sans incident
- Ne jamais approuver un payout sur une transaction avec un ReconciliationCase CRITICAL ouvert
