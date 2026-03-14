# Valises Backend — V1 Release Readiness Checklist

## 0) Objectif

Cette checklist sert de référence finale avant passage de `develop` vers une release V1 stable.

Elle couvre :

* la stabilité technique
* la sécurité minimale V1
* la cohérence fonctionnelle métier
* la qualité API / docs
* la qualité DB / migrations
* la préparation opérationnelle
* la validation Git / CI / release

> Statut recommandé d’utilisation : cocher chaque point dans l’ordre, ne pas lancer la release tant qu’un bloc critique n’est pas entièrement validé.

---

## 1) Branche et discipline Git

### 1.1 Branche de travail

* [ ] Je suis bien positionné sur `develop`
* [ ] Mon `develop` local est à jour avec `origin/develop`
* [ ] Je crée une branche dédiée pour la phase release readiness
* [ ] Le nom de branche respecte la convention projet

### 1.2 Propreté du repo

* [ ] `git status` est propre avant de commencer
* [ ] Aucun fichier temporaire local ne traîne
* [ ] Aucun secret n’est commité
* [ ] Aucun fichier `.env` réel n’est tracké
* [ ] Les fins de ligne sont normalisées correctement

### 1.3 Pull Request

* [ ] Tous les changements passent par PR
* [ ] La PR cible bien `develop`
* [ ] La PR contient une description claire
* [ ] La PR contient le périmètre exact de ce qui a été validé
* [ ] La PR mentionne explicitement les risques restants éventuels

---

## 2) Installation / reproductibilité

### 2.1 Installation propre

* [ ] Un clone propre du projet fonctionne sans bricolage caché
* [ ] `npm install` fonctionne correctement
* [ ] `npx prisma generate` fonctionne correctement
* [ ] `npx prisma migrate deploy` fonctionne correctement
* [ ] L’application démarre sans erreur

### 2.2 Variables d’environnement

* [ ] `.env.example` est complet
* [ ] Chaque variable de `.env.example` est documentée dans le README ou dans une section dédiée
* [ ] Les variables obligatoires sont réellement validées au démarrage
* [ ] L’application échoue proprement si une variable critique manque
* [ ] Aucun nom de variable ambigu ou obsolète ne reste dans le projet

### 2.3 Onboarding développeur

* [ ] Un développeur externe peut lancer le projet uniquement avec le README
* [ ] Les commandes de démarrage sont exactes
* [ ] Les prérequis sont explicitement listés
* [ ] Les versions importantes (Node, Postgres, Prisma) sont précisées

---

## 3) Build / qualité générale

### 3.1 Build

* [ ] `npm run build` passe sans erreur
* [ ] Il n’y a pas d’avertissement inquiétant non traité
* [ ] Le build de production est cohérent avec l’état du code

### 3.2 Lint / format

* [ ] Le lint passe si configuré
* [ ] Le formatage est homogène dans le repo
* [ ] Il n’y a pas de fichiers mélangés CRLF/LF problématiques
* [ ] Il n’y a pas de code mort évident laissé dans les modules principaux

### 3.3 Logs et erreurs

* [ ] Les erreurs sont gérées proprement côté API
* [ ] Les réponses d’erreur ne leakent pas d’informations sensibles
* [ ] Les messages d’erreur principaux sont compréhensibles
* [ ] Les logs serveur sont suffisants pour diagnostiquer un incident V1

---

## 4) Base de données / Prisma / migrations

### 4.1 Schéma Prisma

* [ ] Le schéma Prisma est cohérent avec le métier actuel V1
* [ ] Aucun modèle obsolète ou partiellement abandonné ne reste sans raison
* [ ] Les relations critiques sont explicites et cohérentes
* [ ] Les enums sont propres et sans legacy inutile

### 4.2 Migrations

* [ ] Toutes les migrations nécessaires sont commitées
* [ ] Une base vide peut être reconstruite uniquement à partir des migrations
* [ ] Les migrations s’appliquent sans intervention manuelle
* [ ] Il n’existe pas de correction SQL manuelle non documentée restante
* [ ] Les noms de migration sont lisibles

### 4.3 Intégrité des données

* [ ] Les contraintes DB critiques sont bien présentes
* [ ] Les champs obligatoires le sont réellement
* [ ] Les index utiles existent sur les recherches fréquentes
* [ ] Les objets financiers critiques sont persistés de manière auditable

---

## 5) Sécurité minimale V1

### 5.1 Authentification

* [ ] Le login fonctionne correctement
* [ ] Les routes publiques sont explicitement marquées
* [ ] Les routes privées sont bien protégées
* [ ] Les tokens invalides sont rejetés proprement
* [ ] Les rôles utilisateur sont correctement propagés dans les guards

### 5.2 Autorisations / RBAC

* [ ] Un USER ne peut pas accéder aux routes ADMIN
* [ ] Un ADMIN peut accéder aux routes prévues
* [ ] Les accès aux transactions sont limités aux acteurs autorisés
* [ ] Les accès aux messages sont limités aux acteurs autorisés
* [ ] Les accès aux endpoints sensibles ont été testés en négatif

### 5.3 Hardening HTTP

* [ ] `helmet` est actif
* [ ] La configuration CORS est cohérente avec l’environnement visé
* [ ] Le rate limit est actif
* [ ] Les endpoints sensibles ne sont pas inutilement publics
* [ ] Swagger n’expose pas d’informations sensibles inutiles

### 5.4 Secrets

* [ ] Aucun secret réel n’est présent dans le repo
* [ ] Les clés de test sont distinctes des clés de prod
* [ ] Les valeurs d’exemple sont clairement non sensibles

---

## 6) Santé applicative / readiness

### 6.1 Health endpoint

* [ ] `GET /health` répond correctement
* [ ] L’endpoint est volontairement public si c’est le choix retenu
* [ ] Le format de réponse est stable et documenté

### 6.2 Readiness réelle

* [ ] La readiness vérifie réellement la DB
* [ ] Un problème DB remonte correctement dans le health/readiness
* [ ] Le comportement attendu en cas d’indisponibilité DB est documenté

### 6.3 Exploitabilité

* [ ] L’équipe sait quoi vérifier en premier si l’API ne démarre pas
* [ ] La doc précise les checks minimum avant déploiement

---

## 7) Couverture métier V1 — Auth / Users / KYC

### 7.1 Users

* [ ] Les créations / lectures utiles fonctionnent
* [ ] Les rôles sont cohérents
* [ ] Les champs critiques utilisateurs sont correctement gérés

### 7.2 KYC gating

* [ ] La mise à jour de statut KYC fonctionne
* [ ] Le paiement est bloqué si le KYC requis n’est pas validé
* [ ] Le message de blocage KYC est explicite
* [ ] Les plafonds liés au KYC sont cohérents
* [ ] Les tests couvrent le refus de paiement sans KYC requis

---

## 8) Couverture métier V1 — Corridors / Trips / Packages

### 8.1 Trips

* [ ] La création d’un trip fonctionne
* [ ] La soumission du ticket fonctionne
* [ ] La vérification admin du ticket fonctionne
* [ ] La publication d’un trip ne peut se faire qu’au bon moment
* [ ] Les permissions sur les trips sont correctes

### 8.2 Packages

* [ ] La création d’un package fonctionne
* [ ] La publication d’un package fonctionne
* [ ] La réservation automatique du package lors de la transaction fonctionne
* [ ] Les incohérences de corridor sont rejetées
* [ ] Les statuts package sont cohérents sur tout le cycle

---

## 9) Couverture métier V1 — Transactions / Escrow / Ledger

### 9.1 Transactions

* [ ] La création de transaction fonctionne
* [ ] Les validations métier à la création sont correctes
* [ ] Les permissions de lecture/écriture sont correctes
* [ ] Les transitions d’état autorisées sont correctement appliquées
* [ ] Les transitions invalides sont rejetées

### 9.2 State machine

* [ ] La machine d’état officielle V1 est respectée
* [ ] Il n’existe pas de contournement facile par endpoint secondaire
* [ ] Les états terminaux sont bien gérés
* [ ] Les tests couvrent les transitions positives et négatives

### 9.3 Escrow / ledger

* [ ] Le `payment success` écrit bien un `ESCROW_CREDIT`
* [ ] Le `release` écrit bien un `ESCROW_DEBIT_RELEASE`
* [ ] Le `refund` écrit bien les écritures attendues
* [ ] Le solde escrow d’une transaction est explicable à tout moment
* [ ] Les écritures ledger sont auditables

### 9.4 Idempotence

* [ ] Les opérations financières critiques sont idempotentes
* [ ] Rejouer un même `payment success` ne double pas les écritures
* [ ] Rejouer un même `release` ne double pas les écritures
* [ ] Rejouer une même résolution de dispute ne double pas les écritures
* [ ] Les idempotency keys sont cohérentes et documentées

---

## 10) Couverture métier V1 — Disputes / refunds / payouts

### 10.1 Disputes

* [ ] L’ouverture d’une dispute fonctionne
* [ ] Les permissions d’ouverture sont correctes
* [ ] La résolution fonctionne
* [ ] La résolution met à jour le statut de dispute correctement
* [ ] La résolution impacte correctement le ledger

### 10.2 Orchestration financière

* [ ] Les scénarios `refund`, `release`, `split` sont cohérents
* [ ] Les montants traités en dispute sont justifiables
* [ ] Le traitement reste atomique
* [ ] Il n’y a pas de double débit / double remboursement

### 10.3 Payout / refund abstraction

* [ ] L’abstraction payout/refund est cohérente
* [ ] Les interfaces sont suffisamment stables pour brancher un PSP réel plus tard
* [ ] Le comportement actuel est clairement documenté comme abstraction V1

---

## 11) Couverture métier V1 — Messaging / anti-contournement / abandon

### 11.1 Messaging

* [ ] Une conversation unique par transaction est respectée si c’est la règle retenue
* [ ] L’envoi de message fonctionne
* [ ] La lecture des messages fonctionne
* [ ] Les permissions d’accès à la conversation sont correctes
* [ ] Aucun acteur non autorisé ne peut lire la conversation

### 11.2 Anti-contournement

* [ ] Les bases anti-contournement prévues pour V1 sont bien en place
* [ ] Aucune exposition inutile d’identité/contact n’existe avant les bons jalons
* [ ] Les protections anti-spam minimum sont actives
* [ ] Les zones de risque restantes sont connues et documentées

### 11.3 Abandon tracking

* [ ] Les événements d’abandon suivis en V1 sont définis clairement
* [ ] Le tracking fonctionne techniquement
* [ ] Le comportement attendu est documenté
* [ ] Les limites de la V1 sont assumées et notées

---

## 12) API / Swagger / lisibilité externe

### 12.1 Swagger

* [ ] Swagger démarre correctement
* [ ] Le bearer token fonctionne correctement dans Swagger
* [ ] Les routes sont correctement groupées
* [ ] Les routes publiques/privées sont compréhensibles
* [ ] Les DTO exposés sont propres et lisibles

### 12.2 Contrats API

* [ ] Les payloads principaux sont cohérents
* [ ] Les statuts HTTP sont cohérents
* [ ] Les erreurs métier majeures ont une réponse stable
* [ ] Les endpoints critiques sont documentés par des exemples si possible

---

## 13) Tests

### 13.1 Unit / service / controller

* [ ] Tous les tests passent localement
* [ ] Les tests couvrent les services critiques
* [ ] Les tests couvrent les permissions critiques
* [ ] Les tests couvrent les transitions d’état critiques
* [ ] Les tests couvrent la logique financière critique

### 13.2 E2E

* [ ] Les e2e principaux passent
* [ ] Le flux money/dispute passe entièrement
* [ ] Les cas négatifs principaux existent
* [ ] Les tests sont stables et non flaky

### 13.3 CI

* [ ] La CI passe sur la PR
* [ ] Les checks requis sont verts
* [ ] La CI reconstruit réellement un environnement propre

---

## 14) Documentation finale minimale V1

### 14.1 README

* [ ] Le README est à jour
* [ ] Le README reflète réellement l’état du projet
* [ ] Les commandes principales sont correctes
* [ ] Les modules V1 sont listés
* [ ] Les limites connues de V1 sont mentionnées

### 14.2 Documentation exploitation

* [ ] Les variables d’environnement sont décrites
* [ ] Les endpoints health/readiness sont décrits
* [ ] Le process de migration DB est décrit
* [ ] Le process de lancement local est décrit
* [ ] Le process de test est décrit

### 14.3 Documentation release

* [ ] La procédure de release est écrite
* [ ] Le point de départ de la release est `develop`
* [ ] Le process de merge vers `main` est explicité
* [ ] Le tag/versioning retenu est explicité si déjà décidé

---

## 15) Vérification manuelle finale avant release

### 15.1 Smoke test manuel minimum

* [ ] Login OK
* [ ] Health OK
* [ ] Swagger OK
* [ ] Création trip OK
* [ ] Submit ticket OK
* [ ] Verify ticket admin OK
* [ ] Publish trip OK
* [ ] Create package OK
* [ ] Publish package OK
* [ ] Create transaction OK
* [ ] Payment success avec KYC OK
* [ ] Ledger visible OK
* [ ] Dispute open OK
* [ ] Dispute resolve OK
* [ ] Release/refund attendu OK
* [ ] Messaging transaction OK

### 15.2 Vérifications négatives minimum

* [ ] USER bloqué sur route ADMIN
* [ ] Payment bloqué sans KYC requis
* [ ] Transition d’état invalide rejetée
* [ ] Accès interdit à une transaction d’un tiers
* [ ] Accès interdit à une conversation d’un tiers

---

## 16) Critères de go / no-go release

## GO si :

* [ ] Build vert
* [ ] Tous les tests verts
* [ ] CI verte
* [ ] Aucun bug bloquant connu sur auth / KYC / transactions / ledger / disputes
* [ ] README et `.env.example` à jour
* [ ] Health/readiness validés
* [ ] Smoke test manuel validé

## NO-GO si :

* [ ] Une écriture financière peut être doublée
* [ ] Une permission sensible peut être contournée
* [ ] Une migration n’est pas reproductible
* [ ] Un endpoint critique n’est pas testable/documenté
* [ ] L’application ne démarre pas proprement depuis zéro

---

## 17) Procédure de release recommandée

### Étape A — Préparation

* [ ] Partir de `develop`
* [ ] Créer branche `chore/xxx-release-readiness-v1`
* [ ] Exécuter build + tests + e2e
* [ ] Compléter cette checklist

### Étape B — Corrections finales

* [ ] Corriger les points bloquants identifiés
* [ ] Rejouer build + tests + e2e
* [ ] Mettre à jour README / doc / `.env.example` si nécessaire

### Étape C — Validation PR

* [ ] Push branche
* [ ] Ouvrir PR vers `develop`
* [ ] Attendre CI verte
* [ ] Review finale
* [ ] Merge dans `develop`

### Étape D — Release branch / main

* [ ] Vérifier que `develop` est propre
* [ ] Ouvrir PR de `develop` vers `main`
* [ ] Refaire un dernier contrôle ciblé
* [ ] Merge vers `main`
* [ ] Poser le tag de release si retenu

---

## 18) Recommandation pratique pour la suite immédiate

Ordre recommandé maintenant :

1. Ajouter cette checklist dans le repo
2. Créer une branche dédiée release readiness
3. Lancer la vérification bloc par bloc
4. Corriger uniquement les vrais gaps bloquants
5. Revalider build/tests/e2e
6. Préparer PR vers `develop`
7. Ensuite seulement préparer le passage vers `main`

---

## 19) Fichier conseillé dans le repo

Nom recommandé :

`docs/release-readiness-v1-checklist.md`

---

## 20) Décision actuelle retenue

À ce stade, la prochaine action n’est pas d’ajouter de nouvelles features.

La priorité est :

* figer l’état V1
* vérifier proprement la readiness
* combler les derniers écarts éventuels
* préparer une release propre, documentée et traçable
