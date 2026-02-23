# DB scripts (one-shot)

Scripts SQL ponctuels (corrections de données / enums). Exécution manuelle seulement.

## Convention
YYYY-MM-DD_description.sql

## Exécution (Prisma)
npx prisma db execute --file scripts/db/<script>.sql --schema prisma/schema.prisma