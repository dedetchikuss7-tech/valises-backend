# Lot #282 — Observabilité Opérationnelle

## Contexte

Sans observabilité, opérer avec `WEBHOOK_ASYNC_ENABLED=true` revient à piloter à l'aveugle : transactions bloquées, payouts échoués et notifications perdues peuvent passer inaperçus pendant des heures. Ce lot crée un endpoint admin unique qui expose l'état de santé opérationnel du système en temps réel.

## Ce qui a été livré

### Nouveau module : `src/operational-health/`

| Fichier | Rôle |
|---|---|
| `operational-health.module.ts` | Module NestJS, importe PrismaModule + BullModule queues |
| `operational-health.controller.ts` | `GET /admin/operational-health` — ADMIN only, Swagger documenté |
| `operational-health.service.ts` | `getHealthSnapshot()` — toutes les métriques en `Promise.all()` |
| `operational-health.service.spec.ts` | 5 tests unitaires |

### Endpoint

```
GET /admin/operational-health
Authorization: Bearer <ADMIN token>
```

### Réponse type

```json
{
  "generatedAt": "2026-05-24T13:00:00.000Z",
  "transactions": {
    "stuckCount": 2,
    "pendingPaymentCount": 0,
    "inTransitCount": 1
  },
  "payouts": {
    "pendingCount": 0,
    "failedCount": 1
  },
  "notifications": {
    "failedOutboxCount": 3,
    "pendingOutboxCount": 0
  },
  "webhooks": {
    "recentFailedCount": 0
  },
  "queues": {
    "webhook": { "waiting": 0, "active": 0, "completed": 45, "failed": 0, "delayed": 0 },
    "notification": { "waiting": 2, "active": 1, "completed": 120, "failed": 0, "delayed": 0 }
  },
  "alerts": [
    { "level": "CRITICAL", "domain": "transactions", "message": "2 transactions PAID sans payout depuis >48h", "count": 2 },
    { "level": "CRITICAL", "domain": "payouts", "message": "1 payouts FAILED non résolus", "count": 1 },
    { "level": "WARNING", "domain": "notifications", "message": "3 notifications FAILED dans l'outbox", "count": 3 }
  ]
}
```

### Métriques couvertes

| Domaine | Métrique | Seuil alerte |
|---|---|---|
| Transactions | PAID sans payout >48h | CRITICAL si > 0 |
| Transactions | CREATED (attente paiement) >24h | WARNING si > 5 |
| Transactions | IN_TRANSIT >7 jours | — |
| Payouts | REQUESTED/PROCESSING >48h | WARNING si > 10 |
| Payouts | FAILED non résolus | CRITICAL si > 0 |
| Notifications | FAILED dans outbox | WARNING si > 0 |
| Notifications | PENDING dans outbox >1h | — |
| Webhooks | ProviderEvent FAILED dans 24h | — |
| Queues | BullMQ webhook + notification job counts | CRITICAL webhook.failed > 5, WARNING notification.failed > 10 |

### Points techniques

- Toutes les requêtes Prisma exécutées en parallèle via `Promise.all()` — latence = max(requêtes) not sum
- `notification_outbox` : raw SQL (`$queryRaw`) car table non modélisée dans le schéma Prisma
- Queues BullMQ : `safeGetQueueStats()` attrape toute exception Redis et retourne `null` — le endpoint ne throw jamais même si Redis est down
- Adaptation schema réelle : `TransactionStatus.PAID` (pas PENDING_PAYMENT), `payout: { is: null }` (relation 1-1), `PayoutStatus.REQUESTED | PROCESSING` (pas PENDING)

## Tests

- **5 nouveaux tests unitaires** couvrant : structure de réponse, alertes CRITICAL transactions, alertes CRITICAL payouts, zéro alerte quand tout est à 0, résilience Redis indisponible
- **851 tests au total** (846 baseline + 5 nouveaux) — tous verts
- Build TypeScript : zéro erreur

## Fichiers modifiés

- `src/app.module.ts` — import `OperationalHealthModule`
- `project-context/CURRENT_STATUS.md` — lot #282 ajouté à l'historique

🤖 Generated with [Claude Code](https://claude.com/claude-code)
