# Lot #283 — Anti-Fraude V2

## Contexte

Ce lot étend le `FraudService` existant avec trois nouvelles détections de fraude plus sophistiquées, sans modifier les méthodes existantes. Il est un prérequis obligatoire pour le lot #286 (payout automatique).

## Ce qui a été livré

### `src/fraud/fraud.service.ts`

| Méthode | Description |
|---|---|
| `checkMultiAccount(userId)` | Normalise les emails Gmail (points + alias `+`), détecte les variantes similaires. Flag `MULTI_ACCOUNT HIGH` si ≥ 2 comptes similaires |
| `checkImpossibleTravel(userId, cityFrom, cityTo)` | Récupère les trips récents (72h) du carrier. Flag `IMPOSSIBLE_TRAVEL MEDIUM` si corridor de destination ≠ `cityFrom` dans une fenêtre de 2h |
| `checkPayoutFarmingV2(userId)` | Agrège payouts PAID sur 30j. Flag `PAYOUT_FARMING_V2 HIGH` si count > 15 ou montant > 500 000 XAF |
| `runFullFraudCheck(userId)` | Exécute les 4 checks en `Promise.all`, retourne un rapport structuré complet |

**FraudFlagType étendu** : `MULTI_ACCOUNT` | `IMPOSSIBLE_TRAVEL` | `PAYOUT_FARMING_V2`

### `src/fraud/dto/fraud-check-result.dto.ts`

Champs optionnels ajoutés : `flagged?`, `relatedUserIds?`, `metadata?`

### `src/fraud/fraud.controller.ts`

```
POST /fraud/users/:id/full-check
Authorization: Bearer <ADMIN token>
```

### `src/fraud/fraud.service.spec.ts` (nouveau — 11 tests)

Couvre les 3 nouvelles méthodes + `runFullFraudCheck` : cas nominal, détection, non-blocage, rapport complet.

## Réponse type `runFullFraudCheck`

```json
{
  "userId": "uuid",
  "checkedAt": "2026-05-24T13:00:00.000Z",
  "blocked": false,
  "blockReason": null,
  "flagCount": 1,
  "flags": [
    { "blocked": false },
    { "blocked": false },
    { "blocked": false, "flagged": true, "reason": "MULTI_ACCOUNT_DETECTED", "relatedUserIds": ["uuid2", "uuid3"] },
    { "blocked": false }
  ]
}
```

## Décisions techniques

- **Non-bloquant par défaut** : les 3 nouvelles détections flaggent sans bloquer (moindre friction, alerte admin préférable au refus automatique)
- **checkImpossibleTravel hors runFullFraudCheck** : nécessite `cityFrom`/`cityTo` disponibles uniquement à la création d'un trip
- **Trip.carrierId** : le modèle Trip utilise `carrierId` (pas `travelerId`) — adapté en conséquence
- **Corridor name comme proxy géographique** : absence de champs `departureCity`/`arrivalCity` sur Trip → utilisation du `corridor.name` pour la comparaison de localisation

## Tests

- `npm run build` : ✅ zéro erreur TypeScript
- `npm test` : ✅ **862 tests** (baseline 851 + 11 nouveaux) — tous verts

## Prérequis satisfait pour

Lot #286 (payout automatique) : peut désormais appeler `runFullFraudCheck` avant de déclencher un payout.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
