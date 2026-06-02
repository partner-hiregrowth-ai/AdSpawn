---
name: AdSpawn
description: Operator-grade Meta Ads management — duplicate, convert, and publish campaign structures at speed.
colors:
  signal-blue: "#3b82f6"
  signal-blue-light: "#60a5fa"
  signal-blue-deep: "#2563eb"
  context-cyan: "#22d3ee"
  deep-void: "#030712"
  surface-card: "#111827"
  surface-overlay: "#1f2937"
  ink-primary: "#f9fafb"
  ink-secondary: "#9ca3af"
  ink-dim: "#6b7280"
  border-default: "#1f2937"
  semantic-success: "#34d399"
  semantic-warning: "#fbbf24"
  semantic-error: "#f87171"
  facebook-action: "#1877F2"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, 'Cascadia Code', monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  "2xl": "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
components:
  button-primary:
    backgroundColor: "#f9fafb"
    textColor: "#111827"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "#e5e7eb"
    textColor: "#111827"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-facebook:
    backgroundColor: "{colors.facebook-action}"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "48px"
  button-facebook-hover:
    backgroundColor: "#1568d3"
    textColor: "#ffffff"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "48px"
---

# Design System: AdSpawn

## 1. Overview

**Creative North Star: "The Mission Terminal"**

AdSpawn is built for media buyers who treat campaign management as precision work. The interface is dark by design — not as aesthetic fashion, but because the people using it spend hours in it, often alongside Meta Ads Manager on a second monitor. The Mission Terminal is a workspace that disappears into the task: no decoration, no onboarding ceremony, no choreography. When a user opens a draft and edits 30 ad sets, the tool's job is to stay out of the way and confirm each decision with quiet precision.

The system is permanently dark. `html.dark` is hardcoded — there is no light mode, no toggle. The depth hierarchy runs from `#030712` (page body) through `#111827` (cards, panels) to `#1f2937` (overlays, hover states). Signal blue (`#3b82f6` / `#60a5fa`) is the sole operational accent: it marks interactive elements, active states, and Meta-connected context. It never decorates.

This system explicitly rejects two failure modes: the cluttered bureaucracy of Meta Ads Manager (everything visible, nothing scannable) and the cold monochrome of developer tools like Vercel (too terminal-native, no professional warmth). AdSpawn sits between them — precise enough for power users, warm enough to be operated confidently for hours.

**Key Characteristics:**
- Always dark; depth through tonal layering, not shadows
- One accent (signal blue) reserved for interaction and active state
- Monospace for all technical values (campaign IDs, account IDs, currency codes)
- Compact density: `text-sm` (14px) is the default, not the exception
- Status is always explicit: ACTIVE / PAUSED / DELETED shown as colored badges, never inferred

## 2. Colors: The Signal Palette

A near-total dark field with one disciplined operational accent. Every color on this surface earns its presence by communicating function.

### Primary

- **Signal Blue** (`#3b82f6`, canonical `oklch(0.623 0.214 259)`): The operational accent. Used for active navigation indicators, interactive element highlights, selected states, and primary call-to-action backgrounds (tinted at 10–15% opacity for subtle surface states). The full-saturation value appears only on active nav indicators (the 3px left-rail stripe) and explicit primary action buttons.

- **Signal Blue Light** (`#60a5fa`, canonical `oklch(0.707 0.165 254)`): The text expression of the accent. Used on active nav labels, account chips, profile chips, and interactive icon states. This is signal-blue seen through text — readable on dark surfaces without full saturation.

- **Signal Blue Deep** (`#2563eb`): The hover and pressed state of primary interactive surfaces. Reserved for animated states, never static.

### Secondary

- **Context Cyan** (`#22d3ee`, canonical `oklch(0.789 0.154 211)`): Used for ad account context only — the ad account switcher icon and its selected state in the navbar. Cyan distinguishes account context from user context (which uses signal-blue). Two blues for two different things.

- **Facebook Action** (`#1877F2`): The login button only. This is Meta's brand blue, used exactly once to signal the OAuth handoff. Never repurposed inside the authenticated app.

### Neutral

- **Deep Void** (`#030712`, `oklch(0.145 0 0)`): The page body background. Tailwind `gray-950`. Always the darkest surface.
- **Surface Card** (`#111827`, `oklch(0.205 0 0)`): Card and panel background. Tailwind `gray-900`.
- **Surface Overlay** (`#1f2937`, `oklch(0.269 0 0)`): Hover states, selected rows, secondary panels. Tailwind `gray-800`.
- **Ink Primary** (`#f9fafb`, `oklch(0.985 0 0)`): Primary text. Headings, card titles, button labels.
- **Ink Secondary** (`#9ca3af`, `oklch(0.708 0 0)`): Supporting text, descriptions, labels.
- **Ink Dim** (`#6b7280`, `oklch(0.556 0 0)`): Tertiary text — IDs, timestamps, metadata. Always paired with monospace.
- **Border Subtle** (`oklch(1 0 0 / 10%)`): All borders in dark mode. A 10% white translucency over the dark surface.

### Semantic

- **Semantic Success / Active** (`#34d399`, emerald-400): ACTIVE status badges. Accompanied by a pulsing dot animation.
- **Semantic Warning / Paused** (`#fbbf24`, amber-400): PAUSED status badges. No animation.
- **Semantic Error / Destructive** (`#f87171`, red-400, `oklch(0.704 0.191 22)`): Validation errors, destructive action buttons, aria-invalid states.

### Named Rules

**The One Signal Rule.** Signal blue (`#3b82f6` / `#60a5fa`) is the only color used for interactive feedback across the authenticated app. Cyan marks ad account context. Emerald/amber mark campaign status. Destructive red marks errors. No other colors communicate state. If a new feature needs to communicate interaction, it uses signal blue — it does not introduce a new accent.

**The Translucency Rule.** Colored backgrounds for states (active nav: `blue-600/15`, account chip: `blue-500/5`, semantic badges: `emerald-500/15`, `amber-500/15`) use low-opacity tints over the dark surface, never solid fills. This keeps the dark environment intact while communicating state.

## 3. Typography

**Body Font:** Inter (via `next/font/google`), fallback `system-ui, sans-serif`
**Mono Font:** `ui-monospace, SFMono-Regular, 'Cascadia Code', monospace` (system; not loaded separately)

**Character:** A single geometric sans-serif at multiple weights. No display pairing — this is an operator tool, not an editorial surface. Inter's tight metrics suit compact data-dense UI. Weight contrast (400 / 500 / 600 / 700) handles all hierarchy within one family.

### Hierarchy

- **Display** (700, 24px, line-height 1.2, tracking -0.01em): Page section headings ("Ad Accounts", "Campaigns"). One per page context.
- **Headline** (700, 18px / `text-lg`, line-height 1.3): App name in navbar ("AdSpawn"). Rarely used.
- **Title** (600, 16px / `text-base`, line-height 1.4): Card titles, modal headings, form section labels.
- **Body** (400–500, 14px / `text-sm`, line-height 1.5): All content text, descriptions, form inputs, table cells. This is the default — the font size of the whole interface.
- **Label** (500, 12px / `text-xs`, line-height 1.4): Button text, chip text, small callouts, nav item labels.
- **Micro/Mono** (400, 10–11px / `text-[10px]` / `text-[11px]`, monospace): Campaign IDs, ad account IDs, currency codes, version labels. Always `font-mono`. Never sentence copy.

### Named Rules

**The Mono Rule.** All technical identifiers — campaign IDs, account IDs, currency codes — are rendered in `font-mono` at 10–11px with `ink-dim` color. The visual distinction between "human label" and "system identifier" must be immediate. Monospace for identifiers, Inter for everything else: no exceptions.

**The One Scale Rule.** Body text is `text-sm` (14px). Not `text-base` unless it's an input or modal heading. Density is a feature, not a compromise.

## 4. Elevation

AdSpawn uses **tonal layering** as its primary depth system, with **interactive lift** as the only use of shadows.

Surfaces are flat at rest. Depth is expressed through background lightness: `deep-void` (#030712) is the floor, `surface-card` (#111827) floats above it, `surface-overlay` (#1f2937) floats above that. The eye reads hierarchy through brightness, not shadow.

Shadows appear in two situations only: structural positioning (the navbar's `0 1px 3px rgba(0,0,0,0.3)` shadow that separates it from the content area) and interactive hover glow on clickable cards (`0 0 20px -5px rgba(59,130,246,0.15)` — the signal-blue glow that confirms a card is interactive). Both are earned by function, not decoration.

### Shadow Vocabulary

- **Structure separator** (`box-shadow: 0 1px 3px rgba(0,0,0,0.3)`): Navbar only. Visually separates the sticky nav layer from the content layer.
- **Interactive hover glow** (`box-shadow: 0 0 20px -5px rgba(59,130,246,0.15)`): Clickable cards (ad account cards on dashboard). Signal blue glow on hover confirms the card is interactive. Appears on hover, not at rest.
- **Login elevation** (`box-shadow: 0 24px 80px rgba(0,0,0,0.5)`): Login panel card only. Heavy lift to separate the auth surface from the animated background. Not used in the authenticated app.

### Named Rules

**The Flat-By-Default Rule.** No surface has a shadow at rest. Shadows are state feedback (hover) or structural separation (nav), never decoration. A card without a shadow is not unfinished — it is correct.

## 5. Components

### Buttons

Compact by design. Default height is `h-8` (32px) for all authenticated-app buttons; `h-12` (48px) for the Facebook login button only.

- **Shape:** Gently rounded (10px, `rounded-lg`). Not pill-shaped — this is a tool, not a marketing surface.
- **Primary (default):** Near-white background (`--primary` dark = `oklch(0.922 0 0)`) with dark text. Used sparingly as an affirmative CTA within modals or confirmation actions.
- **Outline:** Transparent background, `border-gray-800/40`, `text-gray-400`. The default button for most toolbar and panel actions (Refresh, Duplicate, Export).
- **Ghost:** Transparent with no border; hover brings `bg-gray-800/50`. Navigation controls and icon-only actions.
- **Destructive:** Soft `bg-destructive/10 text-destructive` — a tinted red, not solid. Used for delete actions.
- **Facebook (login only):** `#1877F2`, full height (48px), `rounded-xl`. This is the only full-saturation blue button in the product.
- **Hover / Focus:** `active:scale-[0.98]` press state on all buttons. Focus ring: `outline-2 outline-blue-500/60` on `:focus-visible`. No ring on mouse click.

### Status Badges

The signature component. Campaign status is the most critical piece of information on any list screen.

- **ACTIVE:** `bg-emerald-500/15 text-emerald-400` rounded-full, 10px font, semibold. Includes a pulsing emerald dot (`pulse-dot` animation) to the left of the label. The pulse communicates live state.
- **PAUSED:** `bg-amber-500/15 text-amber-400` rounded-full. No dot — paused has no pulse.
- **Other (DELETED, ARCHIVED):** `bg-gray-800 text-gray-500`. Neutral; no semantic color.

### Cards / Containers

- **Corner style:** `rounded-xl` (12px). Larger radius than buttons — cards are containers, not controls.
- **Background:** `bg-gray-900/50` at rest, `bg-gray-900/80` on hover. The transparency against `gray-950` creates visible depth without a border.
- **Border:** `border-gray-800/60` at rest; shifts to `border-blue-500/30` on hover to reinforce the interactive signal from the blue glow.
- **Shadow:** None at rest. Signal-blue hover glow (`card-glow` class) on hover for clickable cards.
- **Internal padding:** `p-4` (16px) default; `p-3` (12px) for compact variant.
- **Loading state:** Animated `animate-pulse` skeletons inside the card layout — no spinner or overlay.

### Inputs / Fields

- **Style:** Transparent background (`bg-transparent` or `dark:bg-input/30`), `border-input` (10% white translucency), `rounded-lg` (10px). Height `h-8` (32px).
- **Placeholder:** `text-muted-foreground` (muted gray). Must clear 4.5:1 against `surface-card` — the current muted tokens are at the boundary; do not reduce further.
- **Focus:** `border-ring` (mid-gray) + `ring-3 ring-ring/50` (soft halo). No blue focus ring on inputs — blue rings are reserved for buttons and interactive controls.
- **Error:** `aria-invalid` triggers `border-destructive` + `ring-destructive/20`. Error state is communicated through border color, not background fill.
- **Disabled:** `opacity-50 cursor-not-allowed`.

### Navigation (Sidebar)

- **Surface:** `bg-gray-950` (same as page body). The sidebar is not elevated — it's a zone on the same plane, separated by a `border-r border-gray-800/60`.
- **Item (inactive):** `text-gray-500`, `hover:text-gray-200 hover:bg-gray-800/60`. 18px icon + 14px label, `rounded-lg` (10px), `px-3 py-2`.
- **Item (active):** `bg-blue-600/15 text-blue-400`. A 3px `bg-blue-500 rounded-r-full` left-rail stripe indicates the current page. The stripe is a navigation affordance, not a decorative side-border.
- **Collapsed state:** 68px wide; labels hidden, icons centered. Active account shown as a 8px blue dot.
- **Active account chip:** `bg-blue-500/5 border border-blue-500/15 text-blue-300` — a barely-visible tinted indicator, not a bold badge.

### Navbar

- **Surface:** `bg-gray-950/90` with `backdrop-blur-xl`. The blur separates it from the content layer without a hard line.
- **Height:** `h-14` (56px). Sticky at `z-50`.
- **Brand mark:** "AdSpawn" in `text-lg font-bold`. Currently rendered as gradient text (blue-400 to cyan-400); see Do's and Don'ts — this should be solid signal-blue.
- **Context breadcrumb:** Page name in `text-gray-400`, selected account in a `bg-blue-500/10 border-blue-500/20 text-blue-400` inline chip. Hierarchy: app name → page → account.
- **Right controls:** Profile switcher + account switcher as compact `bg-gray-800/40 border-gray-700/40` pills; user avatar as `rounded-full bg-gradient-to-br from-blue-500 to-cyan-500`.

### Dropdowns / Menus

- **Surface:** `bg-gray-900 border-gray-800`. No blur — dropdowns are not modals.
- **Item:** `text-xs text-gray-300`, hover via shadcn/ui default.
- **Section labels:** `text-[10px] text-gray-600 uppercase tracking-wider` — the only uppercase in the system.
- **Active item:** `text-blue-400 bg-blue-500/5`.
- **Separator:** `bg-gray-800`.

## 6. Do's and Don'ts

### Do:

- **Do** use signal-blue (`#60a5fa` for text, `#3b82f6` for backgrounds) exclusively for interactive and active state — no other role, ever.
- **Do** use monospace (`font-mono`) for all technical identifiers: campaign IDs, ad account IDs, currency codes, version labels.
- **Do** show status explicitly via StatusBadge (ACTIVE / PAUSED / other) — never infer it from context or hide it behind a hover.
- **Do** use `active:scale-[0.98]` on all buttons for a tactile press response.
- **Do** use skeleton placeholders during loading — never a centered spinner inside content areas.
- **Do** keep all borders as translucent white (`border-white/10` family) or the `border-gray-800/60` equivalent. Full-opacity gray borders read as heavy on dark surfaces.
- **Do** use `text-sm` (14px) as the default body text size. Density is a feature.
- **Do** use `@prefers-reduced-motion` to replace fade-in-up sequences and float animations with instant visibility or simple opacity transitions.
- **Do** keep empty states instructional: show what action creates the missing data, not just "nothing here."

### Don't:

- **Don't** use gradient text (`background-clip: text` with a gradient). The navbar's current "AdSpawn" gradient and the login hero gradient both violate this. Replace with solid `text-[#60a5fa]` (signal-blue-light). Gradient text is decorative, never meaningful.
- **Don't** introduce a second accent color inside the authenticated app. Signal blue is the only accent. Do not add purple, green, orange, or teal as a new interactive color.
- **Don't** build interfaces that look like Meta Ads Manager: dense grids with no breathing room, every field visible regardless of relevance, no hierarchy between primary and secondary data. AdSpawn exists because Ads Manager is exhausting.
- **Don't** go terminal-native (Vercel, Linear aesthetic): pure gray monochrome, no warmth, type-only interfaces. AdSpawn is professional, not devtool-cold.
- **Don't** use decorative motion. The `float-orb` and `gradient-shift` animations are login-page only. In the authenticated app, motion communicates state (loading skeleton pulse, active status pulse dot, fade-in-up for initial content load). Nothing else.
- **Don't** use side-stripe borders (`border-left` / `border-right` greater than 1px colored) on cards or list items. The sidebar's 3px active indicator is a navigation affordance, not a card pattern.
- **Don't** create a light mode. The app is dark-only — `html.dark` is hardcoded. Do not build components that rely on light-mode tokens.
- **Don't** use `text-gray-600` or `text-gray-700` for body copy on dark surfaces — at `oklch(0.439)` and `oklch(0.371)`, these fail 4.5:1 contrast against `surface-card`. Use `text-gray-400` (`#9ca3af`) as the minimum for readable secondary text.
- **Don't** use `modal` as a first resort. Inline edits, slide-over panels, and inline validation handle most actions. Modals are for destructive confirmations and creation flows that cannot be inline.
