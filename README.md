# AdSpawn - Facebook Ads Structure Duplication & Management Tool

A modern full-stack web application for duplicating, converting, and managing Facebook Ads structures using the Meta Marketing API v21.0.

## Core Features

- **Objective Conversion**: Intelligently convert campaigns between all 6 objectives (Awareness, Engagement, Traffic, Leads, Sales, App Promotion) with automatic field migration.
- **Wide Creation**: Bulk structure generation from templates with inheritance resolution and tree validation.
- **Draft System**: Duplicate/convert campaigns to local drafts, edit freely, then publish to Meta when ready.
- **Nested Explorer**: Browse campaigns, ad sets, and ads in a tree-like interface with rename and bulk delete.
- **Bulk Duplication**: Select multiple items and duplicate them at once with deep copy support.
- **Bulk Edit**: Edit shared fields across heterogeneous selections with compatibility detection.
- **Dynamic Form Schema**: Recursive Meta-compatible form system that adapts per objective/context.
- **Safety First**: Every new object is created with status **PAUSED** to prevent accidental ad spend.
- **Creative Reuse**: Reuses original `creative_id` to preserve social proof (likes, comments, shares).
- **Naming Patterns**: Customize the name of duplicated objects using templates.
- **Audit Log**: Keep track of all duplication jobs and their status.
- **Automated Testing**: 1267 auto-generated tests with 99.38% line coverage and Meta API drift detection.

## Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Zustand
- **Backend**: Node.js, Express.js, TypeScript, Axios
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Facebook OAuth 2.0
- **API**: Meta Marketing API v21.0

## Documentation

Full project documentation is available in the [wiki/](wiki/) directory, covering architecture, service internals, domain concepts, API reference, and testing strategy. See [wiki/index.md](wiki/index.md) for the complete table of contents.

## Project Structure

```
├── wiki/                # Project documentation wiki
├── backend/
│   ├── prisma/              # Database schema and migrations
│   ├── src/
│   │   ├── controllers/     # Request handlers (adAccount, auth, draft, duplication, template, wideCreation)
│   │   ├── services/
│   │   │   ├── draft/       # Core engines
│   │   │   │   ├── MetaFieldRegistry.ts           # Field definitions, valid enums, defaults, migrations
│   │   │   │   ├── FieldOptimizationEngine.ts     # Payload transformation & optimization
│   │   │   │   ├── MetaFormSchemaEngine.ts        # Dynamic form schema generator
│   │   │   │   ├── DraftValidationEngine.ts       # Pre-publish validation
│   │   │   │   ├── DraftPublishService.ts         # Publishes drafts to Meta API
│   │   │   │   ├── DraftService.ts                # Duplicate/convert live campaigns to drafts
│   │   │   │   ├── DraftCampaignService.ts        # Campaign CRUD
│   │   │   │   ├── DraftAdSetService.ts           # AdSet CRUD
│   │   │   │   ├── DraftAdService.ts              # Ad CRUD
│   │   │   │   ├── BulkEditCompatibilityEngine.ts # Cross-selection field compatibility
│   │   │   │   └── WideCreationService.ts         # Template -> draft generation
│   │   │   ├── facebook.service.ts                # Meta Graph API client
│   │   │   └── objectiveConversion.service.ts     # Live objective conversion
│   │   ├── routes/          # Express route definitions
│   │   └── middleware/      # Auth middleware
│   └── tests/
│       ├── unit/            # Field matrix, conversion matrix, publish, form schema, bulk edit
│       ├── contracts/       # Meta API payload shape contracts
│       ├── integration/     # Full pipeline tests
│       ├── snapshots/       # Payload stability snapshots
│       ├── drift/           # Live Meta API drift detection
│       └── fixtures/        # Shared realistic test data for all 6 objectives
└── frontend/
    ├── src/
    │   ├── app/             # Pages (login, dashboard, explorer, drafts, wide-create, history)
    │   ├── components/
    │   │   ├── dashboard/   # Dashboard widgets
    │   │   ├── meta/        # Dynamic form system (SchemaField, MetaForm)
    │   │   ├── wide-create/ # Structure wizard + tree configurator
    │   │   ├── layout/      # App layout
    │   │   └── ui/          # shadcn/ui components
    │   ├── services/        # API client (axios + interceptors)
    │   └── store/           # Zustand stores (app state, wide creation)
```

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- Meta App with `ads_management`, `ads_read`, and `business_management` permissions
- Meta App must be in **Live mode** for full ad creation (development mode only supports creative_id references)

### Backend Setup

1. Navigate to `backend/`
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials:
   ```
   PORT=5000
   DATABASE_URL=postgresql://user:pass@localhost:5432/adsduplicator
   JWT_SECRET=your-secret
   FB_APP_ID=your-app-id
   FB_APP_SECRET=your-app-secret
   ```
4. Run Prisma migrations: `npx prisma migrate dev`
5. Start the server: `npm run dev`

### Frontend Setup

1. Navigate to `frontend/`
2. Install dependencies: `npm install`
3. Create `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   NEXT_PUBLIC_FB_APP_ID=your-app-id
   ```
4. Start the development server: `npm run dev`

## Testing

```bash
cd backend
npm test              # Run all tests (1267 tests, ~1s)
npm run test:watch    # Watch mode for development
npm run test:coverage # With v8 coverage report (98.85% statements, 99.38% lines, 100% functions)
npm run test:drift    # Live Meta API drift detection (needs META_ACCESS_TOKEN)
```

Tests auto-generate from `MetaFieldRegistry` — adding a new objective or field automatically creates corresponding test cases covering:
- Optimization goal x objective compatibility (full matrix)
- N x N objective conversion (all 30 pairs)
- Budget x bid strategy x objective combinations
- Payload contract validation against Meta API shapes
- Snapshot stability for all transformation outputs
- DraftPublishService (destination_type inference, promoted_object, page_id injection, CBO)
- DraftService (pixel fallback, page_id discovery, conversion flows)
- Live drift detection via Meta `validation_only=true`

## API Endpoints

| Prefix | Purpose |
|--------|---------|
| `POST /api/auth/facebook` | Facebook OAuth login |
| `GET /api/adaccounts` | List ad accounts, campaigns, adsets, ads |
| `POST /api/adaccounts/bulk-delete` | Bulk delete from Meta |
| `POST /api/drafts/duplicate` | Duplicate live campaign to draft |
| `POST /api/drafts/campaigns/:id/publish` | Publish draft to Meta |
| `POST /api/drafts/campaigns/bulk-publish` | Bulk publish drafts |
| `POST /api/drafts/bulk-edit/*` | Bulk edit schema/validate/apply |
| `POST /api/drafts/form-schema` | Dynamic form schema |
| `POST /api/duplicate/campaign` | Live duplicate campaign |
| `POST /api/duplicate/convert-objective` | Live objective conversion |
| `POST /api/wide-creation/generate` | Generate drafts from template |
| `POST /api/wide-creation/validate` | Validate template |

## Safety Requirements

- All duplicated Campaigns, Ad Sets, and Ads are created as **PAUSED**
- Creative IDs are reused to maintain social proof
- Thailand targeting enforces `age_min >= 20`
- Validation runs before publish to catch Meta API constraint violations
- Token security via JWT + automatic expired token redirect

## Deployment

### Backend
- Deploy as a standard Node.js application (e.g., Railway, DigitalOcean, Heroku)
- Ensure `DATABASE_URL`, `JWT_SECRET`, `FB_APP_ID`, `FB_APP_SECRET` are set

### Frontend
- Deploy on Vercel or Netlify
- Set `NEXT_PUBLIC_API_URL` to your backend URL
- Set `NEXT_PUBLIC_FB_APP_ID` to your Meta App ID

## License
MIT
