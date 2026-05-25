# Protection Valises — Politique de compensation

## Ce qu'est la Protection Valises

La Protection Valises est un mécanisme d'indemnisation volontaire proposé par
Valises aux expéditeurs en cas de perte, dommage ou retard avéré d'un colis.

**Ce n'est PAS une assurance.** Valises n'est pas un assureur. La Protection
Valises est une décision commerciale discrétionnaire, pas une obligation légale.

## Qui peut faire une demande

- Uniquement l'expéditeur (sender) de la transaction
- Le voyageur ne peut jamais soumettre une demande en son nom propre
- La demande doit être soumise dans les 7 jours suivant la confirmation de livraison

## Conditions d'éligibilité

1. La transaction doit être au statut DELIVERED ou DISPUTED
2. La demande doit être soumise dans les 7 jours suivant `deliveryConfirmedAt`
3. Une seule demande par transaction — pas de doublon
4. Le montant déclaré ne peut pas dépasser `PROTECTION_MAX_AMOUNT_XAF` (50 000 XAF par défaut)

## Types de demandes

- **LOST** : colis introuvable, non remis au destinataire
- **DAMAGED** : colis remis mais endommagé
- **DELAYED** : colis remis avec un retard significatif causant un préjudice

## Processus de traitement

1. L'expéditeur soumet sa demande avec description et preuves (photos, échanges)
2. Un admin examine le dossier — statut `UNDER_INVESTIGATION` si investigation nécessaire
3. L'admin approuve ou rejette — **aucune automatisation n'est permise**
4. En cas d'approbation, le montant approuvé est plafonné à `PROTECTION_MAX_AMOUNT_XAF`
5. Le paiement effectif (statut `PAID`) est déclenché manuellement par un admin

## Principe anti-arbitraire

Chaque décision doit être documentée dans `adminNotes`. Une approbation ou un
rejet sans note explicative n'est pas acceptable. Les notes sont auditables.

## Ce que la Protection Valises ne couvre pas

- Les litiges entre expéditeur et voyageur non liés au transport physique
- Les colis dont la valeur déclarée dépasse le plafond
- Les demandes soumises au-delà de la fenêtre de 7 jours
- Les demandes du voyageur pour ses propres pertes ou frais
