# Runbook — Fraud Escalation

## Symptômes
- FraudFlag actif (resolvedAt IS NULL) sur un user
- Score de fraude élevé retourné par `POST /fraud/users/:id/full-check`
- Signalement d'un utilisateur par un autre (dispute, message abusif)
- Activité suspecte : vitesse de transactions élevée, voyages impossibles, multi-comptes

## Niveaux d'escalade

### Niveau 1 — Surveillance (automatique)
Déclencheur : 1 FraudFlag actif, severity LOW ou MEDIUM
Action : aucune suspension, surveiller les prochaines transactions

### Niveau 2 — Review manuelle (admin)
Déclencheur : FraudFlag severity HIGH, ou 2+ flags actifs toutes severités
Actions :
1. Lancer le check complet : `POST /fraud/users/:id/full-check`
2. Consulter l'historique des transactions et disputes de l'user
3. Décider : surveillance renforcée, suspension temporaire, ou bannissement

### Niveau 3 — Suspension temporaire
Déclencheur : pattern clair de fraude (PAYOUT_FARMING, MULTI_ACCOUNT confirmé)
Actions :
1. Suspendre le compte (lot #297 — à implémenter)
2. Geler les payouts en attente
3. Notifier l'user par email
4. Documenter dans AdminTimeline

### Niveau 4 — Bannissement définitif
Déclencheur : fraude confirmée, multi-comptes avérés, tentative d'abus grave
Actions :
1. Bannir le compte (lot #297)
2. Conserver toutes les données (réglementaire)
3. Bloquer les futurs comptes avec le même email/téléphone si possible
4. Ouvrir un dossier si montants significatifs (>50 000 XAF)

## Comment résoudre un FraudFlag
Un FraudFlag ne doit être résolu que si l'investigation confirme un faux positif.
Documenter la raison de résolution dans le flag avant de le marquer résolu.

## Prévention
- Vérifier `/admin/operational-health` quotidiennement pour les nouveaux flags
- Ne jamais approuver un payout auto-éligible si un FraudFlag HIGH est actif
- Croiser les signaux : un flag isolé peut être un faux positif, 3 flags = action requise
