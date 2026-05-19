# CloneZone — User Documentation

CloneZone is a Meta Ads management tool for duplicating, converting, and scaling ad structures across campaigns, ad sets, and ads.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Dashboard — Select an Account](#2-dashboard--select-an-account)
3. [Explorer — Browse & Act on Live Campaigns](#3-explorer--browse--act-on-live-campaigns)
4. [Drafts — Edit & Publish](#4-drafts--edit--publish)
5. [Wide Creation — Build at Scale](#5-wide-creation--build-at-scale)
6. [History — Audit Log](#6-history--audit-log)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Getting Started

Open the app and click **Continue with Facebook**. You will be redirected to Facebook to authorise access to your ad accounts. Once approved, you are returned to the Dashboard.

---

## 2. Dashboard — Select an Account

The Dashboard lists all ad accounts your Facebook user has access to. Click any card to select that account and go directly to the Explorer.

- The selected account is shown in the top navigation bar on every page.
- Click the account name in the navbar at any time to return to the Dashboard and switch accounts.

---

## 3. Explorer — Browse & Act on Live Campaigns

The Explorer lets you browse your live Meta campaigns, select items, and perform actions on them.

### Browsing

- Campaigns load automatically for the selected account.
- Click the **arrow** on a campaign row to expand it and load its ad sets.
- Click the **arrow** on an ad set row to expand it and load its ads.
- Use the **search bar** to filter by name across campaigns, ad sets, and ads.
- Use the **sort dropdown** to order campaigns by: Newest First, Oldest First, Name A→Z, Name Z→A, Status, Objective, or Budget.
- Click any name to **inline-edit** it and save it directly to Meta.

### Selecting

- Click the **checkbox** on any campaign, ad set, or ad to select it.
- You can mix levels — select campaigns and ad sets in the same operation.
- Use **Select All** to select everything currently visible.
- The selection count badge and Action Panel appear once at least one item is selected.

### Action Panel

When items are selected, the Action Panel opens on the right (stacks below on mobile). Two modes:

#### Duplicate
Copies selected items on Meta as PAUSED.

| Setting | Description |
|---------|-------------|
| **Rename Pattern** | Template for the new name. Variables: `{{campaign_name}}`, `{{adset_name}}`, `{{ad_name}}`, `{{country}}`, `{{angle}}`, `{{date}}`, `{{iteration_number}}` |
| **Copies** | Number of copies to create per selected item |
| **Country / Angle** | Context variables injected into the rename pattern |
| **Deep** | When on, duplicates the full hierarchy (campaign → ad sets → ads). When off, duplicates only the selected level. |
| **Destination Account** | Target ad account for the duplicate (defaults to the current account) |
| **Analyze** | Previews the fields that will be copied and lets you override values before duplicating |

Click **Duplicate** to create. All new objects are created as **PAUSED** on Meta.

Click **Save as Draft** to copy the campaign structure into the internal Drafts system instead of publishing directly to Meta.

#### Convert Objective
Changes the campaign objective to a different one. Only available when a single campaign is selected.

| Setting | Description |
|---------|-------------|
| **Target Objective** | The new objective to convert to |
| **New Name** | Name for the converted campaign |
| **Analyze** | Previews field transformations needed for the conversion |

Click **Save as Draft** to create a local draft with the converted structure, or **Convert & Publish** to push directly to Meta.

### Bulk Actions (bottom of Action Panel)

| Action | Description |
|--------|-------------|
| **Activate** | Sets all selected items to ACTIVE on Meta |
| **Pause** | Sets all selected items to PAUSED on Meta |
| **Delete** | Permanently deletes selected items from Meta (irreversible) |

---

## 4. Drafts — Edit & Publish

Drafts are local copies of campaign structures that you can edit before pushing to Meta. They are created by:
- **Save as Draft** from the Explorer
- **Convert Objective → Save as Draft** from the Explorer
- **Generate Drafts** from Wide Creation

### Drafts List

- **Search** drafts by name or objective.
- **Sort** by date, name, status, or objective.
- Toggle **Show Published** to include drafts that have already been published.
- Select multiple drafts using checkboxes for bulk operations.

#### Bulk Operations

| Button | Action |
|--------|--------|
| **Bulk Edit** | Edit a shared field (e.g. budget, bid strategy) across multiple selected drafts at once |
| **Bulk Publish** | Publish all selected drafts to Meta as PAUSED campaigns |
| **Activate** | Set selected published campaigns to ACTIVE on Meta |
| **Pause** | Set selected published campaigns to PAUSED on Meta |
| **Delete** | Delete selected drafts (local only — does not affect Meta) |

### Draft Editor

Click any draft to open the editor. The left panel shows the **campaign → ad set → ad tree**. Click any node to load its fields in the right panel.

The right panel has four tabs:

| Tab | Description |
|-----|-------------|
| **Edit** | Simplified form with the most commonly edited fields |
| **Full Schema** | Complete form with every configurable Meta field for that entity type |
| **Summary** | Read-only overview of all configured values |
| **Raw JSON** | The raw data payload that will be sent to Meta |

#### Validation & Publishing

- Click **Validate** to check all entities against Meta's constraints before publishing. Errors are listed with the field path and reason.
- Click **Publish to Meta** to create all campaign → ad set → ad entities on Meta as PAUSED.
- If you have already published and want to re-publish cleanly, click **Cleanup Meta** first to delete the previously created Meta objects, then publish again.

---

## 5. Wide Creation — Build at Scale

Wide Creation lets you define a large campaign structure (multiple objectives × campaigns × ad sets × ads) and generate all the drafts in one step.

The wizard has 5 steps:

### Step 1 — Objectives

Select which campaign objectives you want to create and how many campaigns per objective. For each objective, set:
- Number of **ad sets per campaign**
- Number of **ads per ad set**
- **Naming patterns** for campaigns, ad sets, and ads

A live counter shows the total number of ads that will be generated.

### Step 2 — Structure

A visual tree of the generated structure is shown. You can:
- Expand campaigns to see ad sets and ads
- Add extra ad sets to a campaign
- Add extra ads to an ad set
- Delete any ad set or ad

### Step 3 — Campaigns

Configure campaign-level settings per objective. Use the **Apply to all** toggle to push settings across all campaigns of that objective at once.

### Step 4 — Ad Sets

Configure ad set settings per objective, including billing event, budget, bid strategy, and schedule. Objectives that require a promoted object (e.g. Page ID for Leads, Pixel ID for Sales) show a warning if not set.

### Step 5 — Ads

Configure the ad creative. Set a **default creative** that applies to all ads, then override per-objective if needed. Creative can be an existing creative ID or inline fields (text, image, headline, CTA, URL).

### Validate & Generate

At any step from Step 3 onwards:
- **Validate** checks the entire template structure for errors before creating anything.
- **Generate Drafts** creates all campaigns, ad sets, and ads as local drafts. A link to the Drafts page appears when complete.

---

## 6. History — Audit Log

The History page shows a log of all duplication and conversion operations performed.

| Column | Description |
|--------|-------------|
| **Type** | CAMPAIGN, ADSET, or AD |
| **Source** | The original Meta ID that was duplicated |
| **Target** | The new Meta ID that was created |
| **Status** | Success or Failed |
| **When** | Relative time of the operation |

- Click **Sync with Facebook** to check which target objects still exist on Meta and remove history entries for objects that have been deleted.
- Click the **trash icon** on any row to delete that history entry.

---

## 7. Troubleshooting

### "Meta API hourly rate limit exceeded"

Meta limits the number of API calls per ad account per hour. When this limit is hit:
- All Explorer expand/collapse actions will fail with this message.
- Wait approximately 1 hour for the limit to reset automatically.
- For production use, request an increased rate limit through [Meta Business Support](https://business.facebook.com).

### Draft publishes but campaign has no ad sets

This can happen if the rate limit was hit during a Save as Draft operation. Delete the empty draft and retry after the rate limit resets.

### "Budget Conflict" when duplicating

Occurs when duplicating an ad set into a CBO (Campaign Budget Optimisation) campaign with budget fields. CloneZone automatically retries without budget fields in this case — no action needed.

### Conversion requires a Page ID / Pixel ID

Some objectives have required `promoted_object` fields:
- **OUTCOME_LEADS** requires a Facebook Page ID
- **OUTCOME_SALES** requires a Meta Pixel ID
- **OUTCOME_APP_PROMOTION** requires an Application ID

These must be set in the draft editor (Full Schema tab → Ad Set → promoted_object) before the draft can be published.

### Published campaign is not visible in Meta

All objects created by CloneZone are set to **PAUSED** status. Go to Meta Ads Manager and activate them manually, or use the **Activate** button in the Explorer or Drafts list.
