# AdSpawn Wiki — Index

## Architecture

- [Architecture Overview](pages/architecture/overview.md) — System design, four core flows, key design decisions
- [Tech Stack](pages/architecture/tech-stack.md) — Backend and frontend technology choices
- [Data Flows](pages/architecture/data-flow.md) — Visual flow diagrams for duplication, conversion, drafts, wide creation
- [Database Schema](pages/architecture/database-schema.md) — Prisma models: User, Draft entities, DuplicateJob, NamingTemplate, PublishLog
- [Auth Flow](pages/architecture/auth-flow.md) — Facebook OAuth login, token exchange, JWT sessions
- [Environment Setup](pages/architecture/setup.md) — Local dev setup, env vars, scripts, FB app requirements

## Backend Services

- [MetaFieldRegistry](pages/services/meta-field-registry.md) — Single source of truth for Meta field definitions, enums, defaults, migration
- [FieldOptimizationEngine](pages/services/field-optimization-engine.md) — Transforms raw Meta data into valid duplication/conversion payloads
- [ObjectiveConversionService](pages/services/objective-conversion-service.md) — Live campaign objective conversion with legacy mapping
- [FacebookService](pages/services/facebook-service.md) — Meta Graph API v21.0 client wrapper
- [Draft System](pages/services/draft-system.md) — Overview of the local draft editing/publishing system
- [DraftPublishService](pages/services/draft-publish-service.md) — Publishes drafts to Meta (campaign → adset → ad)
- [DraftValidationEngine](pages/services/draft-validation-engine.md) — Pre-publish validation against Meta constraints
- [MetaFormSchemaEngine](pages/services/meta-form-schema-engine.md) — Generates dynamic UI form schemas
- [BulkEditCompatibilityEngine](pages/services/bulk-edit-compatibility-engine.md) — Computes shared editable fields for bulk editing
- [WideCreationService](pages/services/wide-creation-service.md) — Bulk campaign structure generation from templates

## Domain Concepts

- [Objectives](pages/concepts/objectives.md) — The 6 Meta ODAX objectives with full compatibility matrices
- [Optimization Goals](pages/concepts/optimization-goals.md) — Valid goals per objective, migration map, bid strategy interaction
- [Destination Types](pages/concepts/destination-types.md) — Valid destination types per objective, special rules
- [Promoted Object](pages/concepts/promoted-object.md) — Required promoted_object fields per objective
- [Campaign Budget Optimization](pages/concepts/cbo.md) — CBO vs non-CBO budget rules
- [Meta API Constraints](pages/concepts/meta-api-constraints.md) — All critical Meta API rules in one place
- [Naming Templates](pages/concepts/naming-templates.md) — User-defined naming patterns for campaigns/adsets/ads

## Frontend

- [Pages](pages/frontend/pages.md) — Login, Dashboard, Explorer, Drafts, Wide Create, History
- [Components](pages/frontend/components.md) — SchemaField, MetaForm, StructureWizard, TreeConfigurator
- [State Management](pages/frontend/state-management.md) — Zustand stores and API client

## API

- [Routes](pages/api/routes.md) — Full endpoint map (auth, adaccounts, duplicate, drafts, templates, wide-creation)
- [Controllers](pages/api/controllers.md) — Controller-to-service mapping

## Testing

- [Testing Strategy](pages/testing/overview.md) — 1267 tests, 98.85% coverage, drift detection, auto-generation
