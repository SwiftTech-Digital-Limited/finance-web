# KoboPlan frontend

A Next.js 16 personal-finance interface for the Finance Allocation API. It keeps physical accounts and purpose buckets as separate ledgers, uses server-authoritative allocation previews, and sends idempotency keys for every critical financial intent.

## Local setup

Copy `.env.example` to `.env.local` and make sure the Express API allows the exact frontend origin with credentials.

```bash
npm install
npm run dev
```

The default API base is `http://localhost:4000/api/v1`.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The app includes authentication and refresh restoration, onboarding, dashboard, accounts, buckets, categories, income sources, allocation rules, server previews, income/expense/transfer/reallocation flows, transaction history and lineage, opening/manual allocation, voiding, monthly spending boundaries, analytics, profile/security, and archived configuration views.
