# Valises Backend — Post-Release Roadmap V1.1

## 0) Objectif

Ce document sert à cadrer la phase immédiatement après la promotion de la baseline V1 sur `main`.

L’objectif n’est plus de stabiliser la release V1 initiale, mais de piloter proprement la suite en séparant :

- les actions de figement / traçabilité de release
- les hardenings non bloquants
- les améliorations techniques utiles à l’exploitation
- les prochains chantiers produit/backend

---

## 1) Statut de départ

La baseline V1 a été promue sur `main`.

### Validé avant promotion

- `npm run build` OK
- `npm test` OK
- `npm run test:e2e` OK
- `npm run scenario:win` OK
- smoke test Swagger manuel OK
- `GET /health` OK avec API + database `up`
- README mis à jour
- `.env.example` cohérent
- checklist de release readiness ajoutée
- `POST /auth/login` renvoie désormais `200`
- sécurité admin non affaiblie
- dispute admin flows toujours couverts par e2e

### Baseline désormais en référence

La branche `main` représente désormais la baseline V1 stable et documentée.

---

## 2) Principe de pilotage post-release

À partir de maintenant, on sépare le travail en 3 blocs :

### Bloc A — Figement / traçabilité release
Travail immédiat, léger, à faire en premier.

### Bloc B — Hardening non bloquant
Travail de robustesse sans remettre en cause la baseline.

### Bloc C — Prochain chantier produit / backend
Travail d’évolution réelle, après que le cadre post-release soit propre.

---

## 3) Bloc A — Figement / traçabilité release

## 3.1 Tag de release Git

### Action
Créer un tag officiel correspondant à la baseline promue sur `main`.

### Recommandation
Tag recommandé :

```text
v1.0.0
