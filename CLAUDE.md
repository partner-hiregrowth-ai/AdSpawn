# AdSpawn - Project Context

## Architecture

Full-stack Meta Ads duplication/conversion tool.

- **Backend**: Express.js + TypeScript, Prisma + PostgreSQL, Meta Marketing API v22.0
- **Frontend**: Next.js (App Router) + TypeScript, Tailwind CSS, shadcn/ui, Zustand

## Key Backend Services

### Core Services (`backend/src/services/`)

| File | Purpose |
|------|---------|
| `facebook.service.ts` | Facebook/Meta API client wrapper (v21.0), handles all graph API calls |
| `objectiveConversion.service.ts` | Live campaign objective conversion (transforms + creates on Meta directly) |

### Draft Services (`backend/src/services/draft/`)

| File | Purpose |
|------|---------|
| `MetaFieldRegistry.ts` | Single source of truth for all Meta field definitions, valid enums per objective, defaults, migration logic, targeting sanitization |
| `FieldOptimizationEngine.ts` | Transforms raw Meta data into valid duplication/conversion payloads (strips read-only, resolves budget conflicts, validates promoted_object) |
| `MetaFormSchemaEngine.ts` | Generates recursive form schemas for dynamic UI rendering (campaign/adset/ad) |
| `DraftValidationEngine.ts` | Pre-publish validation against Meta constraints |
| `DraftPublishService.ts` | Publishes draft entities to Meta API (campaign → adset → ad) |
| `DraftService.ts` | Duplicates/converts live Meta campaigns into local drafts |
| `DraftCampaignService.ts` | Campaign CRUD + conversion logic |
| `DraftAdSetService.ts` | AdSet CRUD |
| `DraftAdService.ts` | Ad CRUD |
| `BulkEditCompatibilityEngine.ts` | Computes shared editable fields across heterogeneous selections |
| `WideCreationService.ts` | Bulk structure generation (template to drafts), inheritance resolution, tree validation |

### Controllers (`backend/src/controllers/`)

| File | Purpose |
|------|---------|
| `adAccount.controller.ts` | Ad account listing, campaign/adset/ad fetching, rename, bulk delete |
| `auth.controller.ts` | Facebook OAuth login |
| `draft.controller.ts` | Draft CRUD, publish, validate, bulk operations, form schema |
| `duplication.controller.ts` | Live duplication, conversion, optimization |
| `template.controller.ts` | Template CRUD |
| `wideCreation.controller.ts` | Wide creation validate, generate, bulk-apply, tree |

### Routes (`backend/src/routes/`)

| Route prefix | File | Key endpoints |
|-------------|------|--------------|
| `/api/auth` | `auth.routes.ts` | `POST /facebook` |
| `/api/adaccounts` | `adAccount.routes.ts` | `GET /`, `GET /:id/campaigns`, `GET /campaigns/:id/adsets`, `GET /adsets/:id/ads`, `PATCH /update-name`, `POST /bulk-delete` |
| `/api/drafts` | `draft.routes.ts` | `POST /duplicate`, CRUD campaigns/adsets/ads, `POST /campaigns/:id/publish`, `POST /campaigns/bulk-publish`, `POST /bulk-edit/*`, `POST /form-schema` |
| `/api/duplicate` | `duplication.routes.ts` | `POST /campaign`, `POST /adset`, `POST /ad`, `POST /bulk`, `POST /convert-objective`, `POST /optimize-*` |
| `/api/templates` | `template.routes.ts` | CRUD |
| `/api/wide-creation` | `wideCreation.routes.ts` | `POST /validate`, `POST /generate`, `POST /bulk-apply`, `POST /tree` |

## Meta API Constraints

- All new objects created as `status: PAUSED`
- CBO campaigns: budget lives at campaign level, adset budget fields must be stripped
- Non-CBO campaigns: require `is_adset_budget_sharing_enabled: false` on creation
- `promoted_object` required for: OUTCOME_LEADS (page_id), OUTCOME_SALES (pixel_id + custom_event_type), OUTCOME_APP_PROMOTION (application_id)
- `attribution_spec` only valid for: OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_APP_PROMOTION
- Bid cap strategies (COST_CAP, LOWEST_COST_WITH_BID_CAP, BID_CAP) require `bid_amount`
- `UNDEFINED` destination_type = "no value" (omit from payload, not sent explicitly)
- OUTCOME_AWARENESS: only supports UNDEFINED destination_type (omit entirely)
- OUTCOME_ENGAGEMENT: destination_type inferred from optimization_goal (POST_ENGAGEMENT->ON_POST, VIDEO_VIEWS/THRUPLAY->ON_VIDEO, MESSAGES->FACEBOOK, else WEBSITE)
- OUTCOME_APP_PROMOTION: destination_type must be `APP`
- Thailand targeting requires `age_min >= 20`
- `object_story_spec` requires `page_id` at the top level
- FB App must be in **Live mode** to create ads with `object_story_spec` (development mode only allows `creative_id` references)

## Testing (`backend/tests/`)

Run tests:
```bash
cd backend
npm test              # All tests (1252 tests, ~1s)
npm run test:watch    # Watch mode
npm run test:coverage # With v8 coverage (98.85% statements, 99.38% lines)
npm run test:drift    # Live Meta API validation (requires META_ACCESS_TOKEN in .env)
```

Test structure:
```
tests/
├── unit/           # Field matrix, conversion matrix, form schema, bulk edit, publish, draft service
├── contracts/      # Meta API payload shape contracts
├── integration/    # Full optimize->validate->contract pipeline
├── snapshots/      # Payload stability snapshots
├── drift/          # Registry consistency + live Meta API drift detection (uses validation_only: true)
└── fixtures/       # Shared realistic test data for all 6 objectives
```

Tests auto-generate from `MetaFieldRegistry` definitions — adding a new objective/field to the registry automatically creates test cases.

Coverage scope: `src/services/draft/**` (configured in `vitest.config.ts`)

## 6 Supported Objectives

OUTCOME_AWARENESS, OUTCOME_ENGAGEMENT, OUTCOME_TRAFFIC, OUTCOME_LEADS, OUTCOME_SALES, OUTCOME_APP_PROMOTION

## Frontend Structure

### Pages (`frontend/src/app/`)

| Page | Purpose |
|------|---------|
| `/login` | Facebook OAuth login |
| `/dashboard` | Main dashboard |
| `/explorer` | Ad account explorer (browse campaigns/adsets/ads, rename, bulk delete) |
| `/drafts` | Draft campaign management (edit, validate, publish, bulk operations) |
| `/wide-create` | Wide creation wizard + tree configurator |
| `/history` | Duplication history |

### Key Components

- `frontend/src/components/meta/SchemaField.tsx` — Recursive field renderer
- `frontend/src/components/meta/MetaForm.tsx` — Stateful form wrapper
- `frontend/src/components/wide-create/` — StructureWizard + TreeConfigurator
- `frontend/src/components/FacebookSDK.tsx` — FB SDK init (v21.0)
- `frontend/src/components/layout/` — App layout components
- `frontend/src/components/dashboard/` — Dashboard widgets

### State Management

- `frontend/src/store/useAppStore.ts` — Global app state (Zustand)
- `frontend/src/store/useWideCreationStore.ts` — Wide creation structure state (Zustand)

### API Client

- `frontend/src/services/api.ts` — Axios instance with auth interceptor, all API methods grouped by domain (authApi, adAccountApi, duplicationApi, templateApi, wideCreationApi, draftApi)

## Environment Variables

### Backend (`backend/.env`)
```
PORT=5000
DATABASE_URL=postgresql://...
JWT_SECRET=...
FB_APP_ID=...
FB_APP_SECRET=...
META_ACCESS_TOKEN=...      # For live drift tests only
META_AD_ACCOUNT_ID=...     # For live drift tests only
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_FB_APP_ID=...
```

## Common Tasks

- **Add new objective**: Update `MetaFieldRegistry.ts` (VALID_OPTIMIZATION_GOALS, VALID_DESTINATION_TYPES, OBJECTIVE_DEFAULTS, PROMOTED_OBJECT_REQUIREMENTS). Tests auto-generate.
- **Add new field**: Add to CAMPAIGN_FIELDS/ADSET_FIELDS/AD_FIELDS in registry. Update form schema engine if UI needed.
- **Fix Meta API drift**: Run `npm run test:drift`, check which validation fails, update registry accordingly.
- **Add new API endpoint**: Create handler in controller, add route in routes file, add API method in `frontend/src/services/api.ts`.

## Critical: Do Not Break

- Duplication flow (live duplicate via `/api/duplicate/*`)
- Conversion flow (objective conversion via `/api/duplicate/convert-objective`)
- These use `objectiveConversion.service.ts` and `FieldOptimizationEngine.ts` — changes to shared utilities must be backward-compatible
