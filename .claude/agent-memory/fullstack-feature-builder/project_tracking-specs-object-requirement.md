---
name: tracking-specs-object-requirement
description: Meta rejects tracking_specs entries that have only action.type and no object reference (error 100/1634005)
metadata:
  type: project
---

Meta Marketing API rejects ad creation when any `tracking_specs` entry contains
only `action.type` with no object reference (page, pixel, conversion_id,
application, fb_pixel, etc.):

> Invalid parameter (code 100/1634005): Each action type must use at least one object.

**Why:** A tracking spec must bind an action type to a concrete object. Specs
like `{"action.type":["link_click"]}` or a duplicate
`{"action.type":["onsite_conversion"]}` (missing its `conversion_id`) are
invalid. Live campaigns can hold such specs internally, but they cannot be
re-sent on a new ad create.

**How to apply:** The draft publish path sanitizes this in
`sanitizeTrackingSpecs` (MetaFieldRegistry.ts), called from
`DraftPublishService.createAd`. The filter keeps a spec only if it has at least
one key besides `action.type` (after stripping `post`/`post.wall`). Do NOT
mutate stored draft tracking_specs — filter only at publish time.

Two OTHER code paths still copy tracking_specs raw to Meta and are NOT yet
sanitized (left untouched to avoid touching the duplication/conversion flows):
- `facebook.service.ts` `duplicateAd` (live duplication)
- `objectiveConversion.service.ts` `transformAd` (objective conversion)
If those ever throw 1634005, they can reuse the exported `sanitizeTrackingSpecs`.
