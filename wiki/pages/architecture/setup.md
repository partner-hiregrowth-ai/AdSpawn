# Environment Setup

How to get AdSpawn running locally.

## Prerequisites

- Node.js
- PostgreSQL database
- Facebook App (in **Live mode** for ad creation with `object_story_spec`)

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env  # Edit with your values
npm run prisma:generate
npm run prisma:migrate
npm run dev            # Starts on port 5000
```

### Backend Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `PORT` | No | Server port (default: 5000) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `FB_APP_ID` | Yes | Facebook App ID |
| `FB_APP_SECRET` | Yes | Facebook App Secret |
| `META_ACCESS_TOKEN` | No | Only for live drift tests |
| `META_AD_ACCOUNT_ID` | No | Only for live drift tests |

## Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local  # Edit with your values
npm run dev                        # Starts on port 3000
```

### Frontend Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL (e.g. `http://localhost:5000/api`) |
| `NEXT_PUBLIC_FB_APP_ID` | Yes | Same FB App ID as backend |

## Key Scripts

### Backend

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server with hot reload (nodemon) |
| `npm run build` | TypeScript compilation |
| `npm start` | Production server |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm test` | Run all tests |
| `npm run test:watch` | Tests in watch mode |
| `npm run test:coverage` | Tests with coverage report |
| `npm run test:drift` | Live Meta API drift detection |

### Frontend

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

## Facebook App Requirements

- App must be in **Live mode** to create ads with `object_story_spec`
- Development mode only allows `creative_id` references
- Required permissions: `ads_management`, `ads_read`

## Related Pages

- [[auth-flow]] — how authentication works
- [[database-schema]] — Prisma models
- [[meta-api-constraints]] — Meta API rules to be aware of
