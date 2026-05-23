# PRE-#254 MODULES AUDIT — Valises Backend

> Lot #273 | Date: 2026-05-23 | Auteur: audit exhaustif des modules créés avant le lot #254 (ère ChatGPT)

---

## Périmètre de l'audit

Tous les modules dans `src/` qui **ne sont pas** dans la liste des modules créés ou refactorisés après le lot #254 :

**Exclusions (post-#254, déjà documentés) :**
`onboarding`, `push`, `review`, `fraud`, `admin-support`, `referral`, `admin-finance`, `matching` (partiellement), `dispute` (partiellement)

---

## Tableau des modules pré-#254

| Module | Path de base | Endpoints exposés | Rôle business | État |
|---|---|---|---|---|
| `abandonment` | `/abandonment` | 4 endpoints | Suivi des abandons utilisateur (trip/package/kyc/payment) avec planification de reminders | COMPLET |
| `activity-feed` | `/activity-feed` | 2 endpoints | Flux d'activité chronologique unifié (user + admin) | COMPLET |
| `admin-abandonment` | `/admin` | 17 endpoints | Administration des événements d'abandon et des jobs de relance | COMPLET |
| `admin-action-audit` | `/admin/action-audits` | 2 endpoints | Journal d'audit des actions admin (actor + target + action) | COMPLET |
| `admin-case-management` | `/admin/case-management` | 11 endpoints | Gestion transverse des cas admin (disputes + AML) avec lifecycle OPEN/TAKE/RELEASE/RESOLVE | COMPLET |
| `admin-dashboard-summary` | `/admin/dashboard` | 15 endpoints | Dashboard admin unifié : métriques, queues, bulk actions | COMPLET |
| `admin-financial-controls` | `/admin/financial-controls` | 3 endpoints | Contrôles financiers avec summary et bulk acknowledge | COMPLET |
| `admin-financial-operations` | `/admin/financial-operations` | 2 endpoints | Queue opérationnelle unifiée payouts/refunds/financial exceptions | COMPLET |
| `admin-ledger-integrity` | `/admin/ledger-integrity` | 2 endpoints | Vérification intégrité du ledger par transaction et liste de mismatches | COMPLET |
| `admin-message-moderation-event` | `/admin/message-moderation-events` | 2 endpoints | Audit des événements de modération messaging (blocked/sanitized) | COMPLET |
| `admin-ops` | `/admin/ops` | 2 endpoints | Dashboard consolidé ops : counts AML/disputes/restrictions/payouts/refunds/abandonment | COMPLET |
| `admin-ownership` | `/admin/ownership` | 6 endpoints | Claim/release/status d'objets opérationnels admin avec SLA summary | COMPLET |
| `admin-reconciliation` | `/admin/reconciliation` | 3 endpoints | Réconciliation financière avec summary et bulk mark-reviewed | COMPLET |
| `admin-timeline` | `/admin/timeline` | 4 endpoints | Timeline opérationnelle admin par objet avec création d'événements manuels | COMPLET |
| `admin-transaction-operations` | `/admin/transaction-operations` | 10 endpoints | Queue opérationnelle transaction + drilldown + case lifecycle + playbooks + timeline | COMPLET |
| `admin-workload` | `/admin/workload` | 12 endpoints | Distribution workload admin : summary/overview/drilldowns/queues/bulk claim-release | COMPLET |
| `aml` | `/aml` | 4 endpoints | Screening AML light (signaux de risque), gestion des cas, résolution manuelle | COMPLET |
| `auth` | `/auth` | 2 endpoints | Authentification JWT (register + login), rate-limited | COMPLET |
| `enforcement` | *(service-only)* | — | Port d'assertion des restrictions comportementales + AML, injecté dans package/transaction/message | COMPLET |
| `evidence` | `/evidence/...` | 7 endpoints | Pièces jointes d'évidence avec upload intent, confirmation, admin review queue | COMPLET |
| `health` | `/health` | 1 endpoint | Healthcheck public API + DB | COMPLET |
| `kyc` | `/kyc` | 4 endpoints | KYC via Stripe Identity (session, sync, manual admin override) | COMPLET |
| `ledger` | *(service-only)* | — | Ledger escrow append-only avec idempotency, balances, audit | COMPLET |
| `legal` | `/legal` | 6 endpoints | Acceptations légales (ToS, notice livraison, règles package) + assertions | COMPLET |
| `message` | `/transactions/:id/messages` | 2 endpoints | Messagerie par transaction avec sanitization anti-circumvention | COMPLET |
| `mobile-contract` | `/mobile` | 1 endpoint | Snapshot contrat mobile : identity + KYC + trust + restrictions + capabilities | COMPLET |
| `notifications` | `/notifications` | 7 endpoints | Notifications utilisateur + outbox admin (emit, ack, retry, cancel) | COMPLET |
| `package` | `/packages/...` | 8 endpoints | Création, contenu, publication, annulation, handover, traveler-ack d'un package | COMPLET |
| `payment` | *(service-only)* | — | Payment intent via PSP (CinetPay/MOCK), endpoint intégré dans TransactionController | COMPLET |
| `payout` | `/payouts` | 10 endpoints | Workflow payout traveler : request, approve, mark-paid/failed, retry, provider events | COMPLET |
| `pricing` | `/pricing` | 3 endpoints | Configuration prix par corridor (list, get, calculate) | COMPLET |
| `provider-webhook` | `/provider-webhooks` | 1 endpoint | Boundary public d'ingestion de webhooks PSP (signature-ready) | COMPLET |
| `readiness` | `/ops` | 2 endpoints | Liveness (`/healthz`) et readiness (`/readyz`) probes K8s-ready | COMPLET |
| `refund` | `/refunds` | 8 endpoints | Workflow refund sender : list, get, provider events, retry, mark-refunded/failed | COMPLET |
| `storage` | *(service-only)* | — | Abstraction provider storage (MOCK_STORAGE + S3/Cloudinary réservés) | COMPLET |
| `transaction` | `/transactions` | 14 endpoints | State machine transaction, delivery code, cancel, block, payment intent, ledger view | COMPLET |
| `trip` | `/trips/...` | 6 endpoints | Création trip, ticket upload/submit/verify, publication | COMPLET |
| `trust` | `/trust` | 6 endpoints | Trust profile, réputation events, behavior restrictions (impose/release/expire) | COMPLET |
| `user` | `/users` | 3 endpoints | CRUD utilisateur basique sans auth guard — legacy stub ChatGPT | STUB |

---

## Détail par module

### `abandonment` — Suivi des abandons utilisateur
**Endpoints :**
- `POST /abandonment/mark` — Crée ou met à jour un événement d'abandon (+ planifie 2 reminders : 30min / 24h)
- `POST /abandonment/resolve` — Résout un événement et annule les reminders PENDING
- `GET /abandonment/mine` — Liste mes événements d'abandon
- `POST /abandonment/process-due` — (admin) Traite les reminder jobs dus en batch

**Rôle :** Permet à l'app mobile de signaler qu'un utilisateur a abandonné en cours de route (trip draft, package draft, KYC en attente, paiement en attente). Alimente le pipeline de re-engagement via ReminderJob.

**Dépendances clés :** `PrismaService` (AbandonmentEvent, ReminderJob)

**État : COMPLET**

---

### `activity-feed` — Flux d'activité chronologique
**Endpoints :**
- `GET /activity-feed/me` — Flux personnel de l'utilisateur connecté
- `GET /activity-feed/admin` — Flux admin (toutes entités, filtrable)

**Rôle :** Agrège en mémoire 8 sources (transactions, disputes, AML, restrictions, payouts, refunds, notifications depuis AdminActionAudit, case management depuis AdminActionAudit) dans un flux trié par date descendante, avec filtres sourceType/severity/q.

**Dépendances clés :** `PrismaService` (Transaction, Dispute, AmlCase, BehaviorRestriction, Payout, Refund, AdminActionAudit)

**Observation :** Les notifications et case management events sont lus depuis `AdminActionAudit` via les actions `NOTIFICATION_EMIT` et `CASE_*` — pas depuis une table Notification dédiée.

**État : COMPLET**

---

### `admin-abandonment` — Administration des abandons
**Endpoints (ADMIN only, base path `/admin`) :**
- `GET /admin/abandonment-events` — Liste avec filtres (userId, kind, status, tripId…)
- `GET /admin/abandonment-events/:id` — Détail d'un événement
- `POST /admin/abandonment-events/:id/reminder-jobs` — Crée un reminder job sur un événement actif
- `POST /admin/abandonment-events/reminder-jobs` — Création batch de reminder jobs
- `POST /admin/abandonment-events/:id/resolve` — Résout un événement
- `POST /admin/abandonment-events/:id/dismiss` — Rejette un événement
- `GET /admin/reminder-jobs` — Liste tous les reminder jobs
- `GET /admin/reminder-jobs/due` — Jobs PENDING dont la date est passée
- `GET /admin/reminder-jobs/actionable` — Jobs PENDING (dus) + FAILED + CANCELLED
- `POST /admin/reminder-jobs/due/trigger` — Déclenche les jobs dus en batch
- `POST /admin/reminder-jobs/due/cancel` — Annule les jobs dus en batch
- `POST /admin/reminder-jobs/trigger` — Déclenche des jobs PENDING en batch
- `POST /admin/reminder-jobs/cancel` — Annule des jobs PENDING/FAILED en batch
- `POST /admin/reminder-jobs/retry` — Requeue des jobs FAILED/CANCELLED en batch
- `POST /admin/reminder-jobs/:id/trigger` — Déclenche un job individuel
- `POST /admin/reminder-jobs/:id/cancel` — Annule un job individuel
- `POST /admin/reminder-jobs/:id/retry` — Requeue un job individuel

**Rôle :** Backoffice complet pour superviser et forcer l'envoi/annulation/retry des reminders d'abandon.

**Dépendances clés :** `PrismaService` (AbandonmentEvent, ReminderJob)

**⚠️ Attention :** Le `@Controller('admin')` déclare la base path `/admin`, ce qui crée un espace de noms commun avec d'autres contrôleurs admin. Pas de conflit actuel (les routes sont toutes préfixées `abandonment-events` ou `reminder-jobs`), mais attention lors de futurs ajouts.

**État : COMPLET**

---

### `admin-action-audit` — Journal d'audit admin
**Endpoints (ADMIN only) :**
- `GET /admin/action-audits` — Liste avec filtres (action, targetType, targetId, actorUserId)
- `GET /admin/action-audits/:id` — Détail d'un enregistrement

**Rôle :** Read model du journal d'audit. Le service expose aussi `record()` et `recordSafe()` utilisés par d'autres modules pour tracer les actions admin.

**Dépendances clés :** `PrismaService` (AdminActionAudit)

**État : COMPLET**

---

### `admin-case-management` — Gestion des cas transverses
**Endpoints (ADMIN only) :**
- `GET /admin/case-management/cases` — Liste avec filtres
- `GET /admin/case-management/cases/:sourceType/:sourceId` — Détail
- `POST /admin/case-management/cases/open` — Ouvre un cas depuis un objet source
- `POST /admin/case-management/cases/:sourceType/:sourceId/take` — Prend en charge
- `POST /admin/case-management/cases/:sourceType/:sourceId/release` — Libère
- `POST /admin/case-management/cases/:sourceType/:sourceId/resolve` — Résout
- `POST /admin/case-management/cases/:sourceType/:sourceId/notes` — Ajoute une note
- `POST /admin/case-management/cases/bulk/take` — Bulk take
- `POST /admin/case-management/cases/bulk/release` — Bulk release
- `POST /admin/case-management/cases/bulk/resolve` — Bulk resolve

**Rôle :** Layer de gestion de cas transverse (dispute, AML, etc.) avec lifecycle OPEN → TAKEN → RELEASED → RESOLVED et traçabilité dans AdminActionAudit.

**Dépendances clés :** `PrismaService`, `AdminActionAuditService`

**État : COMPLET**

---

### `admin-dashboard-summary` — Dashboard admin unifié
**Endpoints (ADMIN only) :**
- `GET /admin/dashboard/summary` — Métriques agrégées (transactions, disputes, payouts, refunds, reminders…)
- `GET /admin/dashboard/activity` — Flux d'activité récente
- `GET /admin/dashboard/queues/transactions-requiring-attention` — Queue transactions à traiter
- `GET /admin/dashboard/queues/open-disputes` — Queue disputes ouverts
- `GET /admin/dashboard/queues/pending-payouts` — Queue payouts en attente
- `GET /admin/dashboard/queues/pending-refunds` — Queue refunds en attente
- `GET /admin/dashboard/queues/actionable-reminder-jobs` — Queue reminder jobs actionnables
- `POST /admin/dashboard/actions/payouts/mark-paid-many` — Bulk mark payouts PAID
- `POST /admin/dashboard/actions/payouts/mark-failed-many` — Bulk mark payouts FAILED
- `POST /admin/dashboard/actions/refunds/mark-refunded-many` — Bulk mark refunds REFUNDED
- `POST /admin/dashboard/actions/refunds/mark-failed-many` — Bulk mark refunds FAILED
- `POST /admin/dashboard/actions/disputes/resolve-many` — Bulk resolve disputes
- `POST /admin/dashboard/actions/reminder-jobs/trigger-many` — Bulk trigger reminder jobs
- `POST /admin/dashboard/actions/reminder-jobs/cancel-many` — Bulk cancel reminder jobs
- `POST /admin/dashboard/actions/reminder-jobs/retry-many` — Bulk retry reminder jobs

**Rôle :** Dashboard opérationnel admin avec vue agrégée et actions bulk pour toutes les entités opérationnelles.

**Dépendances clés :** `PrismaService` (multiples), `PayoutService`, `RefundService`, `DisputeService`, `AdminAbandonmentService`

**État : COMPLET**

---

### `admin-financial-controls` — Contrôles financiers
**Endpoints (ADMIN only) :**
- `GET /admin/financial-controls/summary` — Résumé des contrôles en attente
- `GET /admin/financial-controls/cases` — Liste des lignes de contrôle
- `POST /admin/financial-controls/cases/bulk/ack` — Bulk acknowledge

**Rôle :** Supervision et validation manuelle des anomalies financières détectées.

**Dépendances clés :** `PrismaService`

**État : COMPLET**

---

### `admin-financial-operations` — Queue opérationnelle financière
**Endpoints (ADMIN only) :**
- `GET /admin/financial-operations/summary` — Summary des opérations actionnables
- `GET /admin/financial-operations/queue` — Queue unifiée payouts/refunds/financial exceptions

**Rôle :** Vue opérationnelle unifiée pour prioriser les actions financières (payouts REQUESTED, refunds REQUESTED, financial control exceptions).

**Dépendances clés :** `PrismaService`

**État : COMPLET**

---

### `admin-ledger-integrity` — Intégrité du ledger
**Endpoints (ADMIN only) :**
- `GET /admin/ledger-integrity/transactions/:transactionId` — Vérifie l'intégrité pour une transaction
- `GET /admin/ledger-integrity/mismatches` — Liste les transactions avec ledger warnings/breach

**Rôle :** Compare `transaction.escrowAmount` aux balances dérivées du ledger et expose les écarts (payout/refund/commission/reserve integrity signals).

**Dépendances clés :** `PrismaService`, `LedgerService`

**État : COMPLET**

---

### `admin-message-moderation-event` — Audit modération messaging
**Endpoints (ADMIN only) :**
- `GET /admin/message-moderation-events` — Liste avec filtres
- `GET /admin/message-moderation-events/:id` — Détail d'un événement

**Rôle :** Read model des événements de modération persistés lors de la sanitization ou du blocage de messages.

**Dépendances clés :** `PrismaService` (MessageModerationEvent)

**État : COMPLET**

---

### `admin-ops` — Dashboard ops consolidé
**Endpoints (ADMIN only) :**
- `GET /admin/ops/dashboard` — Counts consolidés (AML, disputes, restrictions, payouts, refunds, abandonment, reminders, shortlist)
- `GET /admin/ops/cases` — Flux unifié de cas ops à traiter

**Rôle :** Vue synthétique pour la supervision opérationnelle quotidienne.

**Dépendances clés :** `PrismaService`

**État : COMPLET**

---

### `admin-ownership` — Ownership et SLA admin
**Endpoints (ADMIN only) :**
- `GET /admin/ownership/summary` — SLA summary (owned, unowned, overdue)
- `GET /admin/ownership` — Liste des ownership rows
- `GET /admin/ownership/:objectType/:objectId` — Ownership d'un objet spécifique
- `POST /admin/ownership/claim` — Prend la propriété d'un objet
- `POST /admin/ownership/release` — Libère la propriété
- `PATCH /admin/ownership/status` — Met à jour le statut opérationnel

**Rôle :** Gestion du claim/release d'objets opérationnels par les admins avec suivi SLA.

**Dépendances clés :** `PrismaService` (AdminOwnership)

**État : COMPLET**

---

### `admin-reconciliation` — Réconciliation financière
**Endpoints (ADMIN only) :**
- `GET /admin/reconciliation/summary` — Résumé des cas à réconcilier
- `GET /admin/reconciliation/cases` — Liste des cas de réconciliation
- `POST /admin/reconciliation/cases/bulk/review` — Bulk mark-reviewed

**Rôle :** Workflow de réconciliation financière entre les données PSP et les enregistrements internes.

**Dépendances clés :** `PrismaService`

**État : COMPLET**

---

### `admin-timeline` — Timeline opérationnelle admin
**Endpoints (ADMIN only) :**
- `GET /admin/timeline` — Liste tous les événements de timeline
- `GET /admin/timeline/events/:id` — Détail d'un événement
- `GET /admin/timeline/:objectType/:objectId` — Timeline pour un objet spécifique
- `POST /admin/timeline/events` — Crée un événement manuel de timeline

**Rôle :** Trace chronologique des actions admin par entité (transaction, dispute, payout, etc.) pour audit et débogage opérationnel.

**Dépendances clés :** `PrismaService` (AdminTimelineEvent)

**État : COMPLET**

---

### `admin-transaction-operations` — Opérations transactionnelles
**Endpoints (ADMIN only, 3 controllers) :**

*Controller principal :*
- `GET /admin/transaction-operations/queue` — Queue opérationnelle avec signaux agrégés
- `GET /admin/transaction-operations/summary` — Summary de la queue
- `GET /admin/transaction-operations/transactions/:transactionId` — Drilldown complet
- `GET /admin/transaction-operations/transactions/:transactionId/case` — Récupère ou crée un cas opérationnel
- `PATCH /admin/transaction-operations/transactions/:transactionId/case` — Met à jour assignment/status/priority/note
- `POST /admin/transaction-operations/transactions/:transactionId/case/resolve` — Résout le cas (sans modifier la transaction)
- `POST /admin/transaction-operations/transactions/:transactionId/case/reopen` — Réouvre le cas

*Playbooks controller :*
- `GET /admin/transaction-operations/playbooks` — Liste des playbooks opérationnels
- `GET /admin/transaction-operations/playbooks/summary` — Summary des playbooks
- `GET /admin/transaction-operations/playbooks/transactions/:transactionId` — Playbook pour une transaction

*Timeline controller :*
- `GET /admin/transaction-operations/transactions/:transactionId/timeline` — Timeline consolidée

**Rôle :** Centre opérationnel complet pour la gestion du cycle de vie transactionnel par un admin : vue agrégée des signaux (dispute/evidence/payout/refund/AML/restrictions), cas opérationnels, playbooks d'action recommandés, timeline.

**Dépendances clés :** `PrismaService`, `LedgerService`, `DisputeService`, `AmlService`

**État : COMPLET**

---

### `admin-workload` — Distribution du workload
**Endpoints (ADMIN only) :**
- `GET /admin/workload/summary` — Summary workload de l'admin connecté
- `GET /admin/workload/overview` — Vue opérationnelle globale
- `GET /admin/workload/drilldowns` — Liste des presets de drilldown disponibles
- `GET /admin/workload/drilldowns/:preset` — Données d'un preset de drilldown
- `GET /admin/workload/assignees` — Distribution par admin assigné
- `GET /admin/workload/queues/:preset` — Queue d'un preset
- `POST /admin/workload/actions/claim` — Claim un item de workload
- `POST /admin/workload/actions/release` — Release un item
- `POST /admin/workload/actions/status` — Met à jour le statut d'un item
- `POST /admin/workload/actions/bulk-claim` — Bulk claim
- `POST /admin/workload/actions/bulk-release` — Bulk release
- `POST /admin/workload/actions/bulk-status` — Bulk status update

**Rôle :** Gestion et distribution du workload entre admins avec presets de queues et actions bulk.

**Dépendances clés :** `PrismaService` (AdminOwnership, AdminTransactionOperationalCase), `AdminWorkloadDrilldownService`

**État : COMPLET**

---

### `aml` — Anti-Money Laundering
**Endpoints (ADMIN only) :**
- `POST /aml/transactions/:transactionId/evaluate` — Évalue une transaction contre les règles AML
- `GET /aml/cases` — Liste des cas AML avec filtres
- `GET /aml/cases/:id` — Détail d'un cas AML
- `POST /aml/cases/:id/resolve` — Résolution manuelle d'un cas

**Rôle :** Screening AML léger à la confirmation de paiement. Génère des signaux de risque (WHITELIST/MONITOR/BLOCK). Les cas BLOCK bloquent le paiement via `EnforcementService`.

**Dépendances clés :** `PrismaService` (AmlCase), injecté dans `EnforcementService`

**État : COMPLET**

---

### `auth` — Authentification JWT
**Endpoints (publics, rate-limited 10 req/min) :**
- `POST /auth/register` — Crée un compte USER + retourne le profil
- `POST /auth/login` — Authentifie et retourne un JWT

**Rôle :** Point d'entrée unique pour l'authentification. JWT HS256, configurable. Passwords hashés bcrypt.

**Dépendances clés :** `PrismaService`, `JwtService`, `bcrypt`

**État : COMPLET**

---

### `enforcement` — Assertions de restrictions comportementales *(service-only)*
**Endpoints :** aucun (port interne)

**Rôle :** Vérifie qu'un utilisateur n'est pas soumis à une `BehaviorRestriction` active avant chaque action critique (PACKAGE_PUBLISH, TRANSACTION_CREATE, TRANSACTION_PAYMENT_SUCCESS, MESSAGING). Intègre aussi l'évaluation AML au moment du paiement.

**Dépendances clés :** `PrismaService` (BehaviorRestriction, LegalAcceptance), `AmlService`

**Injecté dans :** `PackageService`, `TransactionService`, `MessageService`

**État : COMPLET**

---

### `evidence` — Pièces à conviction
**Endpoints :**
- `POST /evidence/upload-intents` — Crée un intent d'upload via StorageProvider
- `POST /evidence/attachments/confirm-upload` — Confirme l'upload et crée l'EvidenceAttachment
- `POST /evidence/attachments` — Crée une référence d'evidence directement
- `GET /evidence/attachments` — Liste (admin: tout ; user: les siennes ou celles d'entités accessibles)
- `GET /evidence/attachments/:id` — Détail
- `PATCH /evidence/attachments/:id/review` — Revue admin (APPROVED/REJECTED)
- `GET /evidence/admin/summary` — Summary admin par review status / target type
- `GET /evidence/admin/review-queue` — Queue de review admin (défaut : PENDING_REVIEW)

**Rôle :** Gestion des preuves (photos, documents) associées aux disputes. Flow d'upload en 2 étapes via StorageProvider.

**Dépendances clés :** `PrismaService` (EvidenceAttachment), `StorageProvider`, `EvidenceUploadIntentService`

**État : COMPLET**

---

### `health` — Healthcheck
**Endpoints (publics) :**
- `GET /health` — Vérifie que l'API et la DB sont up

**Rôle :** Probe de santé basique pour load balancers.

**Dépendances clés :** `PrismaService`

**État : COMPLET**

---

### `kyc` — Vérification d'identité
**Endpoints :**
- `GET /kyc/me` — Mon statut KYC + dernière session
- `POST /kyc/me/session` — Crée une session Stripe Identity (→ URL de vérification)
- `POST /kyc/verifications/:id/sync` — Synchronise le statut depuis Stripe
- `PATCH /kyc/users/:id/status` — (ADMIN) Override manuel du statut KYC

**Rôle :** Gating KYC avant les transactions. Intégré à Stripe Identity en mode webhook-forward.

**Dépendances clés :** `PrismaService` (KycVerification), `Stripe` (Identity)

**État : COMPLET**

---

### `ledger` — Ledger escrow *(service-only)*
**Endpoints :** aucun (service interne)

**Rôle :** Ledger append-only avec idempotency keys. Fournit `createEntry()`, `getBalances()` (escrow, commission, reserve, releasable), `listByTransaction()`. Base de toute la comptabilité interne.

**Dépendances clés :** `PrismaService` (LedgerEntry)

**Injecté dans :** `TransactionService`, `PayoutService`, `RefundService`, `AdminLedgerIntegrityService`

**État : COMPLET**

---

### `legal` — Acceptations légales
**Endpoints :**
- `POST /legal/acceptances/me` — Enregistre une acceptation légale pour l'utilisateur connecté
- `GET /legal/acceptances/me` — Liste mes acceptations
- `GET /legal/acceptances` — (ADMIN) Liste toutes les acceptances avec filtres
- `POST /legal/transactions/:transactionId/acknowledge-platform-role` — Acknowledge rôle limité de la plateforme
- `POST /legal/transactions/:transactionId/acknowledge-delivery-risk` — Acknowledge risque de livraison
- `POST /legal/packages/:packageId/acknowledge-rules` — Acknowledge règles package (prohibited items)

**Rôle :** Traçabilité des acceptations légales et CYA (Cover Your Assets) avant les opérations critiques. Les assertions `assertTransactionPlatformRoleAcknowledged`, `assertTransactionDeliveryRiskAcknowledged` bloquent les endpoints transaction si non complétées.

**Dépendances clés :** `PrismaService` (LegalAcceptance)

**Injecté dans :** `TransactionController`

**État : COMPLET**

---

### `message` — Messagerie par transaction
**Endpoints :**
- `POST /transactions/:transactionId/messages` — Envoie un message (ouvert seulement après paiement confirmé)
- `GET /transactions/:transactionId/messages` — Liste les messages (paginé, cursor-based)

**Rôle :** Canal de communication entre sender et traveler pour une transaction confirmée. Messages soumis à anti-circumvention (regex contact info) et anti-spam (duplicate, cooldown).

**Dépendances clés :** `PrismaService` (Message, MessageModerationEvent), `MessageSanitizerService`, `EnforcementService`

**État : COMPLET**

---

### `mobile-contract` — Contrat API mobile
**Endpoints :**
- `GET /mobile/me/contract` — Snapshot contrat mobile de l'utilisateur connecté

**Rôle :** Endpoint unique pour les apps mobiles : retourne user identity + KYC summary + trust profile + restrictions actives + capabilities dérivées + legal acceptances summary.

**Dépendances clés :** `PrismaService` (User, KycVerification, TrustProfile, BehaviorRestriction, LegalAcceptance)

**État : COMPLET** (noté "in refinement" en contexte — le contrat est stable mais peut évoluer)

---

### `notifications` — Notifications
**Endpoints :**
- `GET /notifications/me` — Flux de notifications de l'utilisateur connecté
- `POST /notifications/:notificationId/ack` — Marque une notification comme lue
- `POST /notifications/emit` — (ADMIN) Émet une notification et enqueue une outbox row
- `GET /notifications/admin/outbox` — (ADMIN) Liste l'outbox des notifications
- `POST /notifications/admin/outbox/process-due` — (ADMIN) Traite les outbox dues
- `POST /notifications/admin/outbox/:id/retry` — (ADMIN) Retry une outbox failed/cancelled
- `POST /notifications/admin/outbox/:id/cancel` — (ADMIN) Annule une outbox

**Rôle :** Système de notifications avec modèle outbox pour la délivrance async. Les providers (email, push) sont abstraits mais non câblés en production.

**Dépendances clés :** `PrismaService` (Notification, NotificationOutbox), `AdminActionAuditService`

**État : COMPLET** (providers non câblés — outbox fonctionnelle, délivrance réelle manquante)

---

### `package` — Gestion des packages
**Endpoints :**
- `POST /packages` — Crée un package en draft
- `PATCH /packages/:id/declare-content` — Déclare le contenu (structured, bloque le contenu prohibé)
- `PATCH /packages/:id/review-content` — (ADMIN) Revue compliance du contenu
- `GET /packages/me` — Liste mes packages
- `PATCH /packages/:id/publish` — Publie un draft (contenu déclaré requis)
- `PATCH /packages/:id/cancel` — Annule un package
- `PATCH /packages/:id/declare-handover` — Signal non-bloquant de remise physique
- `PATCH /packages/:id/acknowledge-traveler-responsibility` — Acknowledge responsabilité du traveler

**Rôle :** Cycle de vie complet d'un package : création → déclaration contenu → vérification → publication → transaction. Gating légal via `EnforcementService` à la publication.

**Dépendances clés :** `PrismaService` (Package, PackageContentDeclaration), `EnforcementService`, `AbandonmentService`

**État : COMPLET**

---

### `payment` — Payment Intent *(service-only)*
**Endpoints :** aucun contrôleur dédié

**Rôle :** `PaymentIntentService` orchestre la création d'un payment intent via le PSP sélectionné (CINETPAY ou MOCK). L'endpoint est exposé dans `TransactionController` : `POST /transactions/:id/payment-intent`.

**Dépendances clés :** `PrismaService`, `PaymentProvider` (CinetPay/MOCK)

**État : COMPLET**

---

### `payout` — Workflow payout
**Endpoints (ADMIN only) :**
- `GET /payouts` — Liste avec filtres
- `GET /payouts/transactions/:transactionId` — Payout d'une transaction
- `GET /payouts/:id` — Détail
- `POST /payouts/transactions/:transactionId/request` — Initie le payout
- `POST /payouts/provider-events/ingest` — Ingère un événement PSP payout
- `POST /payouts/transactions/:transactionId/reconcile-provider-events` — Réconcilie les événements
- `POST /payouts/:id/retry` — Retry (FAILED/CANCELLED)
- `PATCH /payouts/:id/approve` — Approuve (READY → REQUESTED)
- `POST /payouts/:id/mark-paid` — Mark PAID + débit ledger
- `POST /payouts/:id/mark-failed` — Mark FAILED sans débit

**Rôle :** Orchestration complète du payout traveler : request → approve → dispatch → reconcile → mark-paid/failed.

**Dépendances clés :** `PrismaService` (Payout, PayoutProviderEvent), `LedgerService`, `PayoutProvider`, `AdminActionAuditService`

**État : COMPLET**

---

### `pricing` — Configuration des prix par corridor
**Endpoints :**
- `GET /pricing/corridors` — Liste les corridors avec signaux summary
- `GET /pricing/corridors/:corridorCode` — Config canonique d'un corridor (ex: `FR_CM`)
- `GET /pricing/corridors/:corridorCode/calculate` — Calcule prix sender / gain traveler / spread

**Rôle :** Fournit la configuration tarifaire par corridor (PER_KG, 23kg bundle, 32kg bundle) et calcule les prix en temps réel.

**Dépendances clés :** `PrismaService` (PricingConfig)

**État : COMPLET**

---

### `provider-webhook` — Ingestion webhooks PSP
**Endpoints (public) :**
- `POST /provider-webhooks/events` — Boundary d'ingestion normalisé, accepte signature + delivery-id + timestamp en headers

**Rôle :** Entrypoint public pour les webhooks des PSP (CinetPay). Route vers `PayoutService.ingestProviderEvent` ou `RefundService.ingestProviderEvent` selon le type d'événement.

**Dépendances clés :** `ProviderWebhookService`, `ProviderWebhookSignatureService`, `PayoutService`, `RefundService`

**État : COMPLET**

---

### `readiness` — Probes K8s
**Endpoints (publics) :**
- `GET /ops/healthz` — Liveness probe (API up, uptime)
- `GET /ops/readyz` — Readiness probe (API + DB, throws 503 si DB down)

**Rôle :** Probes de disponibilité pour orchestrateurs (K8s, ECS, etc.).

**Dépendances clés :** `PrismaService`

**État : COMPLET**

---

### `refund` — Workflow refund
**Endpoints (ADMIN only) :**
- `GET /refunds` — Liste avec filtres
- `GET /refunds/transactions/:transactionId` — Refund d'une transaction
- `GET /refunds/:id` — Détail
- `POST /refunds/provider-events/ingest` — Ingère un événement PSP refund
- `POST /refunds/transactions/:transactionId/reconcile-provider-events` — Réconcilie les événements
- `POST /refunds/:id/retry` — Retry (FAILED/CANCELLED)
- `POST /refunds/:id/mark-refunded` — Mark REFUNDED + débit ledger
- `POST /refunds/:id/mark-failed` — Mark FAILED sans débit

**Rôle :** Workflow de remboursement sender : création (via transaction/dispute) → dispatch → reconcile → mark-refunded/failed.

**Dépendances clés :** `PrismaService` (Refund, RefundProviderEvent), `LedgerService`, `RefundProvider`, `AdminActionAuditService`

**État : COMPLET**

---

### `storage` — Abstraction Storage *(service-only)*
**Endpoints :** aucun

**Rôle :** Provider pattern pour le stockage de fichiers. `MOCK_STORAGE` en dev/staging ; S3/Cloudinary réservés pour la production.

**Dépendances clés :** `StorageConfig`

**Injecté dans :** `TripService` (ticket upload), `EvidenceUploadIntentService`

**État : COMPLET** (provider réel non câblé)

---

### `transaction` — Machine d'état transactionnelle
**Endpoints :**
- `POST /transactions` — Crée une transaction (pricing auto depuis corridor + weight)
- `GET /transactions` — Liste (ADMIN: tout ; USER: les siennes)
- `GET /transactions/:id` — Détail
- `PATCH /transactions/:id/status` — Met à jour le statut business (CREATED, PAID, CANCELLED, DISPUTED)
- `POST /transactions/:id/cancel-before-departure` — Annulation sender pre-départ (→ refund request)
- `POST /transactions/:id/cancel-before-departure/traveler` — Annulation traveler pre-départ (→ refund request)
- `POST /transactions/:id/block-after-departure` — Blocage sender post-départ (→ DISPUTED)
- `POST /transactions/:id/block-after-departure/traveler` — Blocage traveler post-départ (→ DISPUTED)
- `POST /transactions/:id/delivery-code` — Génère ou régénère le code de livraison
- `PATCH /transactions/:id/confirm-delivery` — Confirme la livraison avec le code (→ DELIVERED + payout auto)
- `PATCH /transactions/:id/release` — Release des fonds escrow
- `PATCH /transactions/:id/payment/:status` — Mark payment success/failed/pending
- `POST /transactions/:id/payment-intent` — Crée un payment intent via PSP
- `GET /transactions/:id/ledger` — Vue du ledger pour une transaction

**Rôle :** Cœur du système. Orchestre l'état de la transaction, le paiement, la livraison, les assertions légales et le déclenchement automatique du payout à la confirmation.

**Dépendances clés :** `PrismaService`, `LedgerService`, `LegalService`, `PaymentIntentService`, `PayoutService`, `EnforcementService`, `AbandonmentService`

**État : COMPLET**

---

### `trip` — Gestion des voyages
**Endpoints :**
- `POST /trips` — Crée un trip en draft
- `GET /trips/me` — Liste mes trips
- `POST /trips/:id/ticket-upload-intent` — Crée un upload intent pour le billet
- `PATCH /trips/:id/submit-ticket` — Soumet les métadonnées du billet (admin verification requise avant publication)
- `PATCH /trips/:id/publish` — Publie le trip (billet vérifié requis)
- `PATCH /admin/trips/:id/verify-ticket` — (ADMIN) Vérifie ou rejette le billet soumis

**Rôle :** Cycle de vie complet d'un voyage : création → upload billet → vérification admin → publication → matching.

**Dépendances clés :** `PrismaService` (Trip, TripTicketUploadIntent), `StorageProvider`, `AbandonmentService`

**État : COMPLET**

---

### `trust` — Profil de confiance & restrictions comportementales
**Endpoints (ADMIN only) :**
- `GET /trust/users/:userId/profile` — Trust profile complet d'un utilisateur
- `POST /trust/users/:userId/events` — Enregistre un événement de réputation
- `POST /trust/users/:userId/restrictions` — Impose une restriction comportementale
- `POST /trust/restrictions/:id/release` — Libère une restriction
- `POST /trust/restrictions/expire-due` — Expire les restrictions dont la date est passée
- `GET /trust/restrictions` — Liste avec filtres (userId, status, kind, scope…)

**Rôle :** Gestion du trust score, des badges de réputation, et des restrictions comportementales (WARNING, BLOCK_MESSAGING, BLOCK_PUBLISHING, LIMIT_TRANSACTIONS, BLOCK_ACCOUNT).

**Dépendances clés :** `PrismaService` (TrustProfile, ReputationEvent, BehaviorRestriction)

**État : COMPLET**

---

### `user` — CRUD utilisateur basique ⚠️ STUB
**Endpoints (SANS auth guard) :**
- `POST /users` — Crée un utilisateur (email, password, role)
- `GET /users` — Liste tous les utilisateurs
- `GET /users/:id` — Détail par ID

**Rôle :** Contrôleur d'origine ChatGPT, non sécurisé. La création d'utilisateur en production passe par `POST /auth/register`. Ce controller expose les données sans guard JWT et permet de créer des users avec n'importe quel rôle.

**⚠️ Gap critique :** Pas de `@UseGuards(JwtAuthGuard)` — les endpoints `/users` sont publics. En production, ce contrôleur devrait être désactivé ou sécurisé.

**Dépendances clés :** `PrismaService`

**État : STUB / LEGACY**

---

## Gaps identifiés

### 1. `user` controller — STUB non sécurisé
- **Problème :** `POST /users`, `GET /users`, `GET /users/:id` sans aucune protection JWT ou rôle.
- **Impact :** Exposition des données utilisateurs et possibilité de créer des comptes ADMIN sans authentification.
- **Action recommandée :** Protéger avec `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')` ou désactiver le controller et rediriger vers `auth/register`.

### 2. `notifications` — providers non câblés
- **Problème :** L'outbox de notifications est fonctionnelle mais les providers email/push ne sont pas câblés.
- **Impact :** Les notifications sont créées et stockées mais jamais livrées en production.
- **Action recommandée :** Câbler un provider (SendGrid, Firebase FCM) via le pattern provider existant.

### 3. `storage` — provider réel non câblé
- **Problème :** `MOCK_STORAGE` en staging. S3/Cloudinary reservés dans la config mais non implémentés.
- **Impact :** Les uploads de tickets de vol et de preuves (evidence) ne sont pas stockés réellement.
- **Action recommandée :** Implémenter `S3StorageProvider` suivant le pattern existant.

### 4. `admin-abandonment` — base path `/admin` trop générique
- **Problème :** `@Controller('admin')` — les routes sont préfixées `/admin/abandonment-events` et `/admin/reminder-jobs`, mais la base path est `/admin`, partagée avec tous les contrôleurs admin.
- **Impact :** Potentiel conflit de namespace si un futur contrôleur utilise aussi `@Controller('admin')`.
- **Action recommandée :** Migrer vers `@Controller('admin/abandonment')` pour isoler.

### 5. `activity-feed` — notifications lues depuis `AdminActionAudit`
- **Problème :** Le service charge les notifications depuis `adminActionAudit.action = 'NOTIFICATION_EMIT'` plutôt que depuis la table `Notification`.
- **Impact :** Si le schéma de AdminActionAudit change, l'activity feed se casse silencieusement.
- **Action recommandée :** Refactoriser pour lire depuis `Notification` directement.

### 6. `payment` — pas de contrôleur dédié
- **Problème :** `POST /transactions/:id/payment-intent` est dans `TransactionController`, pas dans `PaymentController`.
- **Impact :** Lisibilité et séparation des responsabilités. Acceptable pour le MVP.
- **Action recommandée :** Acceptable en l'état.

---

## Décisions héritées (patterns architecturaux ChatGPT)

### D1. Controllers Trip et Package avec base path vide `@Controller()`
Les contrôleurs `TripController` et `PackageController` déclarent `@Controller()` (base path vide) et nomment leurs routes explicitement dans chaque décorateur (`@Post('trips')`, `@Get('packages/me')`). Ce pattern diverge de tous les autres controllers qui utilisent une base path nommée.

**Impact :** Pas d'impact fonctionnel, mais inconsistant avec la convention du projet.

### D2. `user` controller sans guards
Le contrôleur `UserController` original n'a pas de `JwtAuthGuard`. C'est le contrôleur ChatGPT initial qui n'a jamais été sécurisé car supplanté par `AuthController`.

### D3. `kyc` utilise Stripe Identity
Le module KYC est câblé sur l'API Stripe Identity (création de session, sync). Ce choix n'est pas documenté dans DECISIONS.md.

### D4. `health` et `readiness` sont deux modules distincts
- `/health` → `HealthController` (healthcheck simple)
- `/ops/healthz` + `/ops/readyz` → `ReadinessController` (liveness + readiness probes K8s)

Ce doublon peut prêter à confusion mais les deux ont des rôles distincts.

### D5. Ledger et Enforcement sont des services sans controllers
Choix délibéré de ne pas exposer le ledger et les assertions d'enforcement en HTTP. Ces services sont des ports internes injectés dans les modules consommateurs.

### D6. `AdminActionAudit` comme bus d'événements de facto
Plusieurs modules (activity-feed, notifications) lisent depuis `AdminActionAudit` pour reconstituer des flux d'événements. C'est un pattern de bus d'événements implicite — pas documenté mais utilisé de facto.

### D7. Payment Intent intégré dans TransactionController
Au lieu d'un `PaymentController` dédié, `POST /transactions/:id/payment-intent` est dans `TransactionController`. Cohérent avec le fait que le payment intent est une sous-opération de la transaction.
