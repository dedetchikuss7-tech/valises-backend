# Production Readiness — Valises Backend

> Lot #277 | Branch: feature/277-production-readiness
> À exécuter avant le premier utilisateur réel en production.

---

## 1. Tests E2E Railway

**Script** : [scripts/production-readiness-check.sh](../scripts/production-readiness-check.sh)

```bash
BASE_URL=https://ton-app.railway.app bash scripts/production-readiness-check.sh
```

Le script effectue 10 vérifications automatiques contre l'environnement cible :

| # | Check | Endpoint | Attendu |
|---|---|---|---|
| 1 | Liveness probe | `GET /ops/healthz` | 200 |
| 2 | Readiness probe + DB | `GET /ops/readyz` | 200 + `ok:true` |
| 3 | Auth register | `POST /auth/register` | 201 |
| 4 | Auth login + JWT | `POST /auth/login` | 200 + token |
| 5 | Endpoint protégé sans token | `GET /transactions` | 401 |
| 6 | Endpoint protégé avec token | `GET /transactions` | 200 |
| 7 | Webhook endpoint public | `POST /provider-webhooks/events` | 400 ou 422 |
| 8 | Swagger désactivé en prod | `GET /docs` | 404 |
| 9 | Health endpoint public | `GET /health` | 200 |
| 10 | Rate limiting auth | 15x `POST /auth/login` | au moins un 429 |

Exemple de sortie :

```
[PASS] CHECK 1 — Liveness probe (200)
[PASS] CHECK 2 — Readiness probe + DB check (200, body ok)
[PASS] CHECK 3 — Auth register smoke test (201)
[PASS] CHECK 4 — Auth login smoke test (200, JWT received)
[PASS] CHECK 5 — Protected endpoint without token (401)
[PASS] CHECK 6 — Protected endpoint with valid token (200)
[PASS] CHECK 7 — Webhook endpoint public accessible (400, not 404/500)
[FAIL] CHECK 8 — Swagger désactivé (got 200, expected 404)
[PASS] CHECK 9 — Health endpoint public (200)
[PASS] CHECK 10 — Rate limiting actif sur auth (429 received)

SUMMARY: 9/10 checks passed (1 failed)
```

---

## 2. Backup DB — Procédure de test restore

1. **Créer un backup manuel** : Railway Dashboard → service PostgreSQL → onglet **Backups** → *Create backup*
2. **Télécharger le dump** : cliquer sur le backup → *Download*
3. **Tester le restore** sur une base de test locale :
   ```bash
   createdb valises_restore_test
   pg_restore -d valises_restore_test backup.dump
   ```
4. **Vérifier les tables critiques** :
   ```sql
   SELECT COUNT(*) FROM "User";
   SELECT COUNT(*) FROM "Transaction";
   SELECT COUNT(*) FROM "LedgerEntry";
   SELECT COUNT(*) FROM "Payout";
   ```
   Toutes les tables doivent avoir des lignes (ou être vides si env staging vierge).

5. **Fréquence recommandée** : backup quotidien automatique (Railway Pro) + backup manuel avant chaque déploiement majeur.

---

## 3. Rotation des secrets — Procédure

Variables rotables sans redéploiement code (Railway Dashboard → service → Variables) :

| Variable | Impact de la rotation | Comportement attendu |
|---|---|---|
| `JWT_SECRET` | Invalide tous les tokens existants | Redéployer → tous les utilisateurs doivent se reconnecter |
| `SENDGRID_API_KEY` | Aucun impact sur les données | Rotation transparente, emails suivants utilisent la nouvelle clé |
| `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` | Les URLs presigned générées avant rotation restent valides jusqu'à expiration (15 min) | Rotation sans impact visible utilisateur |
| `CINETPAY_API_KEY` | Confirmer que les webhooks CinetPay en transit utilisent la signature de l'ancienne clé | Attendre la fin des webhooks en vol avant de tourner |

**Procédure standard JWT_SECRET** :
```bash
# 1. Générer un nouveau secret fort
openssl rand -base64 64

# 2. Mettre à jour dans Railway Dashboard
# 3. Redéployer le service
# 4. Tous les tokens existants sont invalidés — comportement attendu
```

---

## 4. Rollback deploy

- **Procédure** : Railway Dashboard → service → onglet **Deployments** → cliquer sur un déploiement précédent → *Redeploy*
- **Temps de rollback estimé** : < 2 minutes
- **Attention DB** : la DB ne rollback pas automatiquement.
  - Si une migration Prisma a été appliquée lors du déploiement à rollbacker, le code rollbacké peut être incompatible avec le schéma actuel.
  - **Vérifier les migrations** avant chaque déploiement en production : `npx prisma migrate status`
  - En cas d'incompatibilité : appliquer manuellement une migration de rollback, ou restaurer depuis le backup (voir §2)

---

## 5. PSP outage simulation

En cas d'indisponibilité CinetPay :

1. **Bascule vers MOCK** : Railway Dashboard → Variables → `PAYMENT_PROVIDER=MOCK` → Redéployer
2. **Impact** : les nouveaux paiements utilisent le mock (pas de vrai débit). Les transactions existantes avec CinetPay gardent leur état persisté en DB (non affecté).
3. **Retour CinetPay** : `PAYMENT_PROVIDER=CINETPAY` → Redéployer
4. **Vérification** : lancer `bash scripts/production-readiness-check.sh` après la bascule

---

## 6. Webhook replay protection

- L'idempotency key est le champ `idempotencyKey` dans le body du webhook (pas le header delivery-id).
- En production, ce champ doit être dérivé de l'ID unique de l'événement CinetPay.
- La clé est stockée en DB avec contrainte `@unique` sur `ProviderEvent.idempotencyKey`.
- Un deuxième webhook avec la même clé est ignoré silencieusement (pas de double payout).

**Script de test** : [scripts/test-idempotency-collision.sh](../scripts/test-idempotency-collision.sh)

```bash
BASE_URL=https://ton-app.railway.app bash scripts/test-idempotency-collision.sh
```

**Comportement attendu** : la deuxième requête retourne le même status que la première, sans 500 ni double enregistrement.

---

## 7. Test JWT expiré

**Script** : [scripts/test-expired-jwt.sh](../scripts/test-expired-jwt.sh)

```bash
JWT_SECRET=votre-secret BASE_URL=https://ton-app.railway.app bash scripts/test-expired-jwt.sh
```

Prérequis : `node` + `jsonwebtoken` installés.

**Comportement attendu** : HTTP 401 Unauthorized.

---

## 8. Test idempotency collision

**Script** : [scripts/test-idempotency-collision.sh](../scripts/test-idempotency-collision.sh)

```bash
BASE_URL=https://ton-app.railway.app bash scripts/test-idempotency-collision.sh
```

**Comportement attendu** : deuxième requête ignorée silencieusement, pas de 500, pas de double payout.

---

## 9. Test concurrent webhook delivery

**Script** : [scripts/test-concurrent-webhooks.sh](../scripts/test-concurrent-webhooks.sh)

```bash
BASE_URL=https://ton-app.railway.app bash scripts/test-concurrent-webhooks.sh
```

Envoie 5 webhooks en parallèle avec des `idempotencyKey` distincts.

**Seuil d'acceptabilité** : 0 réponse 500 sur 5 requêtes concurrentes.

---

## 10. Variables d'env production — Checklist

Liste exhaustive des variables requises en production :

| Variable | Module | Requis | Notes |
|---|---|---|---|
| `DATABASE_URL` | Prisma | ✅ | Railway auto-injecté |
| `JWT_SECRET` | auth | ✅ | Générer avec `openssl rand -base64 64` |
| `JWT_EXPIRATION` | auth | ✅ | ex: `7d` |
| `NODE_ENV` | global | ✅ | `production` |
| `PAYMENT_PROVIDER` | payment | ✅ | `CINETPAY` en prod |
| `CINETPAY_API_KEY` | payment | ✅ si CINETPAY | Clé production CinetPay |
| `CINETPAY_SITE_ID` | payment | ✅ si CINETPAY | Site ID production CinetPay |
| `CINETPAY_NOTIFY_URL` | payment | ✅ si CINETPAY | URL Railway du webhook CinetPay |
| `STORAGE_PROVIDER` | storage | ✅ | `S3` en prod |
| `S3_BUCKET` | storage | ✅ si S3 | Bucket privé AWS |
| `S3_REGION` | storage | ✅ si S3 | ex: `eu-west-3` |
| `AWS_ACCESS_KEY_ID` | storage | ✅ si S3 | IAM avec droits S3 minimal |
| `AWS_SECRET_ACCESS_KEY` | storage | ✅ si S3 | |
| `NOTIFICATIONS_PROVIDER` | notifications | ✅ | `SENDGRID` en prod |
| `SENDGRID_API_KEY` | notifications | ✅ si SENDGRID | |
| `SENDGRID_FROM_EMAIL` | notifications | ✅ si SENDGRID | Email vérifié dans SendGrid |
| `CORS_ORIGINS` | security | ✅ | URLs FlutterFlow + app mobile séparées par virgule |
| `SWAGGER_ENABLED` | docs | ✅ | `false` en prod |
| `SENTRY_DSN` | monitoring | ⚠️ optionnel | Recommandé — erreurs prod capturées |
| `PROVIDER_WEBHOOK_SECRET_MOCK_STRIPE` | webhook | ⚠️ si MOCK_STRIPE | Secret HMAC pour validation de signature |

**Validation** : après avoir défini toutes les variables dans Railway, vérifier que le démarrage ne lève pas d'erreur Joi :
```bash
# Dans les logs Railway, rechercher :
# [ConfigModule] Configuration validation passed
# et non : ConfigValidationException
```
