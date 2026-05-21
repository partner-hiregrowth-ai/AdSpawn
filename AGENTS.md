# Agent Instructions for AdSpawn

## Critical Rule

**Do NOT break the duplication or conversion flows.** These are production-critical:
- Live duplicate: `POST /api/duplicate/campaign`, `/adset`, `/ad`, `/bulk`
- Live convert: `POST /api/duplicate/convert-objective`
- Services: `objectiveConversion.service.ts`, `FieldOptimizationEngine.ts`

Always run `cd backend && npm test` after changes to verify nothing is broken.

## Project Layout

```
backend/         Express.js + TypeScript API server
frontend/        Next.js (App Router) + TypeScript client
```

## Backend

### How to run

```bash
cd backend
npm run dev          # Start dev server (port 5000)
npm test             # Run all 1267 tests (~1s)
npm run test:coverage  # Coverage report
```

### Service architecture

All draft/duplication logic lives in `backend/src/services/draft/`. The single source of truth for Meta field rules is `MetaFieldRegistry.ts` — never hardcode field validity elsewhere.

Key data flow:
1. **Duplicate/Convert to Draft**: `DraftService.ts` fetches from Meta, transforms via `ObjectiveConversionService`, saves to Postgres
2. **Edit Draft**: `DraftCampaignService/AdSetService/AdService` handle CRUD, `MetaFormSchemaEngine` provides UI schema
3. **Publish Draft**: `DraftPublishService.ts` validates via `DraftValidationEngine`, then creates on Meta API

### Meta API rules to follow

- Always create with `status: PAUSED`
- Non-CBO campaigns need `is_adset_budget_sharing_enabled: false`
- AWARENESS: omit `destination_type` (do not send UNDEFINED)
- ENGAGEMENT: always infer `destination_type` from `optimization_goal`
- APP_PROMOTION: `destination_type` must be `APP`
- Thailand targeting: `age_min >= 20`
- SALES promoted_object needs both `pixel_id` and `custom_event_type`
- `object_story_spec` needs `page_id` at top level
- API version: v21.0

### Testing conventions

- Tests auto-generate from `MetaFieldRegistry` — add a field/objective there and tests appear
- Coverage scoped to `src/services/draft/**`
- Drift tests (`tests/drift/`) hit real Meta API with `validation_only: true` — never create real objects
- Never mock what you can test directly (use real service instances for pure transform functions)
- Test files mirror service names: `DraftPublishService.ts` -> `tests/unit/draft-publish-service.test.ts`

### Adding a new feature

1. If it involves Meta fields: update `MetaFieldRegistry.ts` first
2. If it needs a new endpoint: controller -> route -> frontend `api.ts`
3. Run `npm test` before committing
4. Do not modify `objectiveConversion.service.ts` without understanding both the live convert flow AND the draft convert flow

## Frontend

### How to run

```bash
cd frontend
npm run dev    # Start dev server (port 3000)
```

### Architecture

- Pages in `src/app/` (App Router)
- API client in `src/services/api.ts` (all endpoints grouped by domain)
- State in `src/store/` (Zustand)
- Dynamic forms via `src/components/meta/SchemaField.tsx` (recursive renderer driven by backend schema)
- Facebook SDK v21.0 loaded in `src/components/FacebookSDK.tsx`

### Adding a new API call

1. Add method to the appropriate export in `frontend/src/services/api.ts`
2. Call from your component/page
3. The axios instance auto-attaches the Bearer token from localStorage

## Environment

### Backend (.env)
```
PORT=5000
DATABASE_URL=postgresql://...
JWT_SECRET=...
FB_APP_ID=...
FB_APP_SECRET=...
META_ACCESS_TOKEN=...      # Only for drift tests
META_AD_ACCOUNT_ID=...     # Only for drift tests
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_FB_APP_ID=...
```

## Common Mistakes to Avoid

- Sending `destination_type: 'UNDEFINED'` to Meta (should be omitted entirely)
- Forgetting `custom_event_type` when setting `pixel_id` on SALES promoted_object
- Not passing `adSet` to `createMetaAd` (needed for page_id injection)
- Modifying `sanitizeTargeting()` without checking Thailand age_min logic
- Adding budget fields to adset payload when campaign is CBO
- Using `creative_id` and `object_story_spec` in the same ad (mutually exclusive)
