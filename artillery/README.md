# Artillery Performance Baseline

## Setup

```bash
npm install --save-dev artillery
```

## Run baseline

```bash
npx artillery run artillery/performance-baseline.yml
```

## Prerequisites

1. Backend running locally: `npm run start:dev`
2. Replace `REPLACE_WITH_VALID_JWT` with a real JWT from a test login
3. Replace corridor/transaction IDs with real seeded values

## Interpretation

- p95 < 500ms: acceptable for alpha
- p99 < 1000ms: acceptable for alpha
- Any > 2000ms: investigate before beta

## Note

These are indicative benchmarks, not SLA contracts.
Run against local DB only — never against production DB.
