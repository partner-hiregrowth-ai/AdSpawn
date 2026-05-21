# Meta Ad Objectives

AdSpawn supports all 6 current Meta (ODAX) campaign objectives. Each objective determines which optimization goals, destination types, and promoted object fields are valid.

## The 6 Objectives

### OUTCOME_AWARENESS
- **Goal**: Maximize brand reach and visibility
- **Optimization goals**: REACH, IMPRESSIONS, AD_RECALL_LIFT, THRUPLAY
- **Destination types**: UNDEFINED only (omit from payload)
- **Promoted object**: None required
- **Default**: optimization_goal=REACH, destination_type=omit

### OUTCOME_TRAFFIC
- **Goal**: Drive users to a destination (website, app, etc.)
- **Optimization goals**: LINK_CLICKS, LANDING_PAGE_VIEWS, REACH, IMPRESSIONS, OFFSITE_CONVERSIONS
- **Destination types**: WEBSITE, APP, MESSENGER, WHATSAPP, INSTAGRAM_DIRECT
- **Promoted object**: None required
- **Default**: optimization_goal=LINK_CLICKS, destination_type=WEBSITE

### OUTCOME_ENGAGEMENT
- **Goal**: Get interactions (likes, comments, views, messages)
- **Optimization goals**: POST_ENGAGEMENT, VIDEO_VIEWS, THRUPLAY, MESSAGES, REACH, IMPRESSIONS
- **Destination types**: WEBSITE, ON_POST, ON_VIDEO, ON_PAGE, ON_EVENT, FACEBOOK, INSTAGRAM_DIRECT
- **Promoted object**: None required
- **Default**: optimization_goal=POST_ENGAGEMENT, destination_type=WEBSITE
- **Special rule**: destination_type is inferred from optimization_goal when not specified:
  - POST_ENGAGEMENT → ON_POST
  - VIDEO_VIEWS/THRUPLAY → ON_VIDEO
  - MESSAGES → FACEBOOK
  - else → WEBSITE

### OUTCOME_LEADS
- **Goal**: Collect leads (forms, calls, messages)
- **Optimization goals**: LEAD_GENERATION, OFFSITE_CONVERSIONS, LINK_CLICKS, QUALITY_LEAD, QUALITY_CALL
- **Destination types**: WEBSITE, ON_AD, MESSENGER, INSTAGRAM_DIRECT, WHATSAPP
- **Promoted object**: Requires `page_id`
- **Default**: optimization_goal=LEAD_GENERATION, destination_type=WEBSITE

### OUTCOME_SALES
- **Goal**: Drive purchases and conversions
- **Optimization goals**: OFFSITE_CONVERSIONS, VALUE, LINK_CLICKS, CONVERSATIONS
- **Destination types**: WEBSITE, APP, MESSENGER, WHATSAPP, SHOP_AUTOMATIC
- **Promoted object**: Requires `pixel_id` (and typically `custom_event_type`)
- **Default**: optimization_goal=OFFSITE_CONVERSIONS, destination_type=WEBSITE

### OUTCOME_APP_PROMOTION
- **Goal**: Drive app installs and in-app actions
- **Optimization goals**: APP_INSTALLS, LINK_CLICKS, OFFSITE_CONVERSIONS, VALUE, APP_INSTALLS_AND_OFFSITE_CONVERSIONS
- **Destination types**: APP, UNDEFINED
- **Promoted object**: Requires `application_id`
- **Default**: optimization_goal=APP_INSTALLS, destination_type=APP

## Legacy Objectives

Pre-ODAX objectives are automatically mapped to current ones by [[objective-conversion-service]]:
- REACH, BRAND_AWARENESS → OUTCOME_AWARENESS
- LINK_CLICKS → OUTCOME_TRAFFIC
- POST_ENGAGEMENT → OUTCOME_ENGAGEMENT
- CONVERSIONS, PRODUCT_CATALOG_SALES → OUTCOME_SALES
- LEAD_GENERATION → OUTCOME_LEADS
- APP_INSTALLS → OUTCOME_APP_PROMOTION

## Related Pages

- [[optimization-goals]] — valid goals per objective
- [[destination-types]] — valid destination types per objective
- [[promoted-object]] — required promoted_object fields per objective
- [[meta-field-registry]] — where all these maps are defined
- [[objective-conversion-service]] — conversion logic
