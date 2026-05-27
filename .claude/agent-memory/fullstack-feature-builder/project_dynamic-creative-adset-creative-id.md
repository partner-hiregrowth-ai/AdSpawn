---
name: dynamic-creative-adset-creative-id
description: Dynamic Creative ad sets require an INLINE asset_feed_spec-only creative on the ad — never a creative_id, never a pre-created adcreative, never object_story_spec
metadata:
  type: project
---

Meta rejects an ad on a Dynamic Creative ad set with error **100/1885702**:
"Only Dynamic Creative ad can be created since the Ad Set is Dynamic Creative Ad Set."

**Why:** A DC ad set cannot reference a standalone creative. Three approaches were tried and
all failed:
1. `creative: { creative_id }` → 1885702 (DC ad set rejects a standalone creative reference)
2. Pre-create an adcreative via `POST /act/adcreatives` with asset_feed_spec → `(#3) Application
   does not have the capability` (gated to Live mode, same as object_story_spec)
3. `creative: { creative_id }` + `is_dynamic_creative: true` on the ad → still 1885702

**The working fix:** Build an INLINE creative embedded directly in the ad's `creative` field
from `asset_feed_spec` + `page_id` (+ `platform_customizations`), with `is_dynamic_creative: true`
on the ad payload. Always OMIT `creative_id`.

**object_story_spec must NEVER be sent in a DC inline creative (FINAL rule — supersedes both
the earlier "always omit" AND the intermediate "conditional/post-backed include" rules).**
A stored `object_story_spec` fetched from Meta is a computed/read-only representation of the
post format. Meta surfaces it to *describe* the post but rejects it back on ad creation with
error **100/1443048** ("Object story spec is ill formed..."), even after stripping
`instagram_user_id` and `link_data.message`. Full chronology that proved this:
1. asset_feed_spec only (no ad_formats) → 2490497 "must select an existing post"
2. + object_story_spec → 1885374 "asset feed must have exactly one ad format"
3. + ad_formats:['SINGLE_IMAGE'] + object_story_spec → 1443048 "ill formed"
4. sanitized object_story_spec still → 1443048
The original 2490497 was actually caused by the MISSING `ad_formats` in asset_feed_spec, NOT
by the absence of object_story_spec. Once `ad_formats` is present, object_story_spec is not
needed and must be omitted entirely.

**ad_formats is REQUIRED on asset_feed_spec (error 100/1885374: "An asset feed can have exactly
one ad format").** When `afs.ad_formats` is absent, infer it from the stored post format:
`object_story_spec.video_data` → `['SINGLE_VIDEO']`, everything else → `['SINGLE_IMAGE']`.
Always set exactly one (no undefined fallback). Never override a stored `ad_formats`. `afs` is
a shallow copy of the stored asset_feed_spec, so this does not mutate the asset_feed_spec-only /
creative_id pre-creation branch.

**How to apply:** In `DraftPublishService.createMetaAd`, the FIRST creative branch is
`if (isDynamicCreativeAdSet && hasAssetFeed)` — it takes priority over the `existingMetaCreativeId
&& hasAssetFeed` creative_id shortcut (which is for NON-dynamic ad sets). The DC branch:
- `page_id` resolved from `adSet.data.promoted_object.page_id` (then adSet.data.page_id, adData.page_id,
  adData.creative.page_id, adData.creative.object_story_spec.page_id)
- trims `call_to_action_types` to 5 (Meta limit)
- infers `afs.ad_formats` if absent (video_data→SINGLE_VIDEO, else SINGLE_IMAGE)
- sets `creative = { asset_feed_spec, page_id, platform_customizations }` — NO object_story_spec, NO creative_id
- log line: "Building inline dynamic creative for ad X (DC ad set, asset_feed_spec only)"
- `isDynamicCreativeAdSet = !!adSet?.data?.is_dynamic_creative`; the `is_dynamic_creative: true` flag is
  still added to `adPayload` afterward (both the inline creative AND the flag are required).
- The downstream identity block (`if (!creative.creative_id)`) is harmless here: page_id is already set
  and there's no object_story_spec to mutate.

`createMetaAdSet` forwards `is_dynamic_creative` to the adset payload; `DraftValidationEngine` reads the
same `adSet.data.is_dynamic_creative` flag. Related to [[tracking-specs-object-requirement]] (both publish-time payload-shape fixes).

**Live-mode hardening (2026-05-27 audit).** A stored asset_feed_spec/platform_customizations fetched from
Meta's GET carries computed/read-only fields that Meta rejects on a *create*. Two publish-time sanitizers in
`DraftPublishService.ts` (module-level functions, applied only in the DC inline branch — never mutate stored draft):
- `sanitizeAssetFeedSpec`: whitelists ONLY the writable fields — `bodies, titles, descriptions, link_urls,
  images, videos, call_to_action_types, ad_formats` (constant `ASSET_FEED_SPEC_WRITABLE_FIELDS`). Drops a
  read-only `id` from each sub-asset entry in `bodies/titles/descriptions/link_urls/images/videos`. Strips
  top-level `id`, `effective_*`, `optimization_type`, `additional_data`, etc. Run BEFORE ad_formats inference
  so an already-set ad_formats survives.
- `sanitizePlatformCustomizations`: recursively strips `id` and any `effective_*` keys from the object and all
  nested objects/arrays.

**Dev-mode error surfacing.** Meta returns error **code 3** ("(#3) Application does not have the capability to
make this API call.") when the FB App is in Development mode — DC inline creatives are gated to Live mode (same
as object_story_spec / adcreative pre-create). `createMetaAd`'s ad-POST catch detects this via
`isDevModeCapabilityError(error)` (checks `errData.code === 3` OR message matches /does not have the capability/i)
guarded by `isDynamicCreativeAdSet`, and throws `PublishError` with userMessage:
"Dynamic Creative ads require the Facebook App to be in Live mode. Switch your app to Live mode in the Facebook
Developer portal and try again." (constant `DEV_MODE_CAPABILITY_MESSAGE`). PublishError.userMessage propagates
through publishCampaign's re-throw.

**Validation warning suppression.** `DraftValidationEngine.validateAd`'s creative_id-override warning
("Platform customizations or dynamic assets will be ignored...") is now suppressed when the parent adset is DC
(`isDynamicCreative` param, the 2nd arg — already passed from `validateFullDraft` as
`!!(adSet.data).is_dynamic_creative`). Reason: the DC publish path builds an inline asset_feed_spec creative and
omits creative_id, so the assets are NOT ignored and the warning is misleading.
