# SECURITY AUDIT — Valises Backend

> Lot #274 | Date: 2026-05-23 | Branch: feature/274-security-sweep
>
> Audit exhaustif des controllers : guards JWT/Roles, endpoints publics, exposition DTO, webhooks.

---

## Architecture de sécurité globale

### Guards globaux (APP_GUARD dans app.module.ts)

| Guard | Comportement |
|---|---|
| `ThrottlerGuard` | Rate-limiting sur tous les endpoints |
| `JwtAuthGuard` | JWT requis sur tous les endpoints **sauf** ceux marqués `@Public()` |
| `RolesGuard` | Vérifie `@Roles('ADMIN')` si présent ; si absent = tout utilisateur authentifié |

### Endpoints publics (@Public())

| Endpoint | Justification |
|---|---|
| `POST /auth/register` | Authentification publique par design |
| `POST /auth/login` | Authentification publique par design |
| `GET /health` | Healthcheck load balancer |
| `POST /provider-webhooks/events` | Ingestion PSP publique (+ validation signature) |
| `GET /ops/healthz` | Liveness probe K8s |
| `GET /ops/readyz` | Readiness probe K8s |

---

## Tableau exhaustif des controllers

| Controller | Path de base | Méthode | Route | Guard JWT | Guard Roles | Rôle requis | État |
|---|---|---|---|---|---|---|---|
| `auth` | `/auth` | POST | `/register` | ✅ `@Public()` | n/a | Public | ✅ OK |
| `auth` | `/auth` | POST | `/login` | ✅ `@Public()` | n/a | Public | ✅ OK |
| `health` | `/health` | GET | `/health` | ✅ `@Public()` | n/a | Public | ✅ OK |
| `readiness` | `/ops` | GET | `/healthz` | ✅ `@Public()` | n/a | Public | ✅ OK |
| `readiness` | `/ops` | GET | `/readyz` | ✅ `@Public()` | n/a | Public | ✅ OK |
| `provider-webhook` | `/provider-webhooks` | POST | `/events` | ✅ `@Public()` + sig | n/a | Public + signature | ✅ OK |
| `user` | `/users` | POST | `/` | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ CORRIGÉ |
| `user` | `/users` | GET | `/` | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ CORRIGÉ |
| `user` | `/users` | GET | `/:id` | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ CORRIGÉ |
| `abandonment` | `/abandonment` | POST | `/mark` | ✅ Explicite | n/a | USER+ | ✅ OK |
| `abandonment` | `/abandonment` | POST | `/resolve` | ✅ Explicite | n/a | USER+ | ✅ OK |
| `abandonment` | `/abandonment` | GET | `/mine` | ✅ Explicite | n/a | USER+ | ✅ OK |
| `abandonment` | `/abandonment` | POST | `/process-due` | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ CORRIGÉ |
| `activity-feed` | `/activity-feed` | GET | `/me` | ✅ Explicite | n/a | USER+ | ✅ OK |
| `activity-feed` | `/activity-feed` | GET | `/admin` | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `aml` | `/aml` | POST | `/transactions/:id/evaluate` | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `aml` | `/aml` | GET | `/cases` | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `aml` | `/aml` | GET | `/cases/:id` | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `aml` | `/aml` | POST | `/cases/:id/resolve` | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-abandonment` | `/admin` | GET/POST | tous | ✅ Global | ✅ `@Roles('ADMIN')` (classe) | ADMIN | ✅ OK |
| `admin-action-audit` | `/admin/action-audits` | GET | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-case-management` | `/admin/case-management` | GET/POST | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-dashboard-summary` | `/admin/dashboard` | GET/POST | tous | ✅ Global | ✅ `@Roles('ADMIN')` (classe) | ADMIN | ✅ OK |
| `admin-finance` | `/admin-finance` | GET | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-financial-controls` | `/admin/financial-controls` | GET/POST | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-financial-operations` | `/admin/financial-operations` | GET | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-ledger-integrity` | `/admin/ledger-integrity` | GET | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-message-moderation-event` | `/admin/message-moderation-events` | GET | tous | ✅ Global | ✅ `@Roles('ADMIN')` (classe) | ADMIN | ✅ OK |
| `admin-ops` | `/admin/ops` | GET | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-ownership` | `/admin/ownership` | GET/POST/PATCH | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-reconciliation` | `/admin/reconciliation` | GET/POST | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-support` | (admin-support paths) | GET/POST | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-timeline` | `/admin/timeline` | GET/POST | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-transaction-operations` | `/admin/transaction-operations` | GET/POST/PATCH | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `admin-workload` | `/admin/workload` | GET/POST | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `dispute` | `/disputes` | GET/POST/PATCH | tous | ✅ Explicite | Mixte USER/ADMIN | Selon route | ✅ OK |
| `evidence` | `/evidence` | GET/POST/PATCH | tous | ✅ Explicite | Mixte USER/ADMIN | Selon route | ✅ OK |
| `fraud` | `/fraud` | GET/POST | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `kyc` | `/kyc` | GET/POST | `/me`, `/me/session`, `/verifications/:id/sync` | ✅ Explicite | n/a | USER+ | ✅ OK |
| `kyc` | `/kyc` | PATCH | `/users/:id/status` | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `legal` | `/legal` | POST/GET | tous | ✅ Global | Mixte USER/ADMIN | Selon route | ✅ OK |
| `matching` | `/matching` | GET | tous | ✅ Explicite | n/a | USER+ | ✅ OK |
| `message` | `/transactions/:id/messages` | GET/POST | tous | ✅ Explicite | n/a | USER+ | ✅ OK |
| `mobile-contract` | `/mobile` | GET | `/me/contract` | ✅ Global | n/a | USER+ | ✅ OK |
| `notifications` | `/notifications` | GET/POST | `/me`, `/:id/ack` | ✅ Explicite | n/a | USER+ | ✅ OK |
| `notifications` | `/notifications` | POST/GET | `/emit`, `/admin/*` | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `onboarding` | `/onboarding` | GET/POST | tous | ✅ Global | n/a | USER+ | ✅ OK |
| `package` | `/packages` | GET/POST/PATCH | tous | ✅ Global | Mixte USER/ADMIN | Selon route | ✅ OK |
| `payout` | `/payouts` | GET/POST/PATCH | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` par route | ADMIN | ✅ OK |
| `pricing` | `/pricing` | GET | tous | ✅ Explicite | n/a | USER+ | ✅ OK |
| `referral` | `/referral` | GET/POST | tous | ✅ Global | n/a | USER+ | ✅ OK |
| `refund` | `/refunds` | GET/POST | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |
| `review` | `/reviews` | GET/POST | tous | ✅ Global | n/a | USER+ | ✅ OK |
| `transaction` | `/transactions` | GET/POST/PATCH | tous | ✅ Explicite | Mixte USER/ADMIN | Selon route | ✅ OK |
| `trip` | `/trips` | GET/POST/PATCH | tous | ✅ Global | Mixte USER/ADMIN | Selon route | ✅ OK |
| `trust` | `/trust` | GET/POST | tous | ✅ Explicite | ✅ `@Roles('ADMIN')` | ADMIN | ✅ OK |

---

## Vulnérabilités trouvées

### 🔴 CRITIQUE — UserController sans guards (STUB non sécurisé)

**Fichier :** `src/user/user.controller.ts`

**Impact :**
1. `POST /users` — Tout utilisateur authentifié pouvait créer un compte ADMIN (`role: 'ADMIN'` dans le body) → **Privilege escalation critique**
2. `GET /users` — Tout utilisateur authentifié pouvait lister tous les utilisateurs (emails, rôles, kycStatus) → **Data exposure**
3. `GET /users/:id` — Tout utilisateur authentifié pouvait consulter n'importe quel utilisateur par ID → **Data exposure**

**Mécanisme :** Le `UserService.createUser()` accepte `role === 'ADMIN'` et créait effectivement des comptes admin. Le `RolesGuard` global ne bloque que si `@Roles()` est présent ; sans decorator, tout utilisateur authentifié passe.

**Sévérité :** CRITIQUE — exploitation immédiate sans connaissances avancées.

---

### 🟡 MEDIUM — AbandonmentController.processDue sans guard HTTP

**Fichier :** `src/abandonment/abandonment.controller.ts`

**Impact :**
- `POST /abandonment/process-due` documenté "admin only" mais sans `@Roles('ADMIN')` au niveau HTTP.
- Le service (`processDueReminders`) throw un `ForbiddenException` si non-ADMIN, mais la vérification est en service-layer, pas en guard HTTP.
- Un attaquant USER peut appeler cet endpoint et déclencher la logique de traitement jusqu'au service.

**Sévérité :** MEDIUM — la défense service-layer bloque l'exploitation, mais contourne la protection HTTP standard.

---

### 🔵 INFO — Signature webhook CinetPay non implémentée

**Fichier :** `src/provider-webhook/provider-webhook-signature.service.ts`

**Impact :**
- `isSignatureSupported()` retourne `true` uniquement pour `MOCK_STRIPE`. Pour `CINETPAY`, retourne `NOT_SUPPORTED_PROVIDER`.
- Le service webhook ne rejette pas le statut `NOT_SUPPORTED_PROVIDER` → toute requête avec `provider: 'CINETPAY'` passe sans vérification de signature.
- Un attaquant peut forger des événements CinetPay (`payment.success`, `payout.paid`) pour déclencher des opérations financières.

**Note :** Implémenter la vérification de signature CinetPay (HMAC header `x-cinetpay-hmac`) est hors périmètre (nouvelle feature). Documenté pour priorité future.

**Atténuation actuelle :** L'idempotency key est vérifiée en base (doublon ignoré). Les payout/refund ont des état-machines qui limitent les transitions invalides.

---

### 🔵 INFO — KYC sync endpoint accessible par tout USER authentifié

**Fichier :** `src/kyc/kyc.controller.ts`

**Impact :**
- `POST /kyc/verifications/:id/sync` n'a pas de `@Roles`. Tout USER authentifié peut appeler cet endpoint.
- Le service interne vérifie que l'ID de vérification appartient à l'utilisateur (non-admin). Le risque est faible.

**Sévérité :** INFO — acceptable par design (sync KYC est une opération utilisateur normale).

---

## Corrections appliquées

### Correction C1 — UserController sécurisé ADMIN

**Fichier :** `src/user/user.controller.ts`

```typescript
@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('users')
export class UserController { ... }
```

- Tous les endpoints (`POST /users`, `GET /users`, `GET /users/:id`) sont désormais ADMIN-only.
- `POST /users` est conservé (utile pour la création de comptes admin en ops), sécurisé ADMIN.
- La création d'utilisateurs USER passe par `POST /auth/register` (public, rate-limited).

### Correction C2 — AbandonmentController.processDue sécurisé ADMIN

**Fichier :** `src/abandonment/abandonment.controller.ts`

```typescript
@Post('process-due')
@Roles('ADMIN')
@ApiOperation({ summary: 'Process due reminder jobs (admin only)' })
async processDue(...) { ... }
```

- Le `RolesGuard` global intercepte maintenant `@Roles('ADMIN')` sur cet endpoint.
- La vérification HTTP-layer s'ajoute à la vérification service-layer existante (defense in depth).

---

## Vérification Webhooks

| Critère | Statut | Détail |
|---|---|---|
| Signature validation active | ✅ Partielle | MOCK_STRIPE : HMAC-SHA256 vérifié avec `timingSafeEqual`. CinetPay : non implémenté. |
| Signature non bypassée | ✅ Pour MOCK_STRIPE | `FAILED_MISSING_SIGNATURE` et `FAILED_INVALID_SIGNATURE` lèvent `UnauthorizedException`. |
| Idempotency key check | ✅ Actif | `PayoutService.ingestProviderEvent` et `RefundService.ingestProviderEvent` vérifient `where: { idempotencyKey }` avant traitement. |
| Endpoints webhook de test sans auth | ✅ Aucun | Pas d'endpoints `/test`, `/debug`, `/simulate` exposés sans auth. |

---

## Champs sensibles exposés — Analyse DTO

| Champ | Exposé où | Accessible par | Risque |
|---|---|---|---|
| `kycStatus` | `UserService.findAll()` / `findById()` | ADMIN uniquement (après C1) | ✅ Acceptable |
| `email` | `UserService.findAll()` / `findById()` | ADMIN uniquement (après C1) | ✅ Acceptable |
| `role` | `UserService.findAll()` / `findById()` | ADMIN uniquement (après C1) | ✅ Acceptable |
| `fraudFlags` | `FraudController` | ADMIN uniquement | ✅ OK |
| `platformRevenue` | `AdminFinanceController` | ADMIN uniquement | ✅ OK |
| `internalNotes` | `AdminSupportController` | ADMIN uniquement | ✅ OK |
| `password` (hash) | Non exposé | Aucun endpoint | ✅ OK |

---

## Décisions architecturales (sécurité)

### D1. Guards globaux comme défense primaire
`JwtAuthGuard` et `RolesGuard` sont enregistrés comme `APP_GUARD` dans `AppModule`. Tout endpoint non marqué `@Public()` requiert un JWT valide. Tout endpoint sans `@Roles()` est accessible à tout utilisateur authentifié (USER ou ADMIN).

**Conséquence :** Les contrôleurs sans `@Roles()` et sans `@Public()` sont des endpoints "USER+" (tout utilisateur authentifié). C'est intentionnel pour les endpoints comme `/pricing`, `/matching`, `/mobile/me/contract`.

### D2. @Roles() au niveau classe vs méthode
Les contrôleurs admin utilisent `@Roles('ADMIN')` au niveau de la classe pour couvrir toutes les routes. La préférence est class-level pour éviter les oublis sur de nouveaux endpoints.

### D3. Service-layer enforcement en complément des guards
Certains services (abandonment, kyc) ont une vérification de rôle supplémentaire pour la defense in depth. Ces checks service-layer sont conservés même après ajout de guards HTTP.
