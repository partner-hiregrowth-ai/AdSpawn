# Product

## Register

product

## Users

Digital marketing professionals and media buyers who manage Meta Ads campaigns at scale. They know the Meta Ads Manager well enough to hate it — they understand campaign structure, objectives, and budgets, and they use AdSpawn to do in seconds what would otherwise take minutes per campaign. They work fast, they have multiple accounts, and they do not need the tool to explain itself.

## Product Purpose

AdSpawn eliminates the manual work of duplicating and converting Meta campaign structures. Users connect their Facebook account, select campaigns, and bulk-duplicate or convert objectives with a few clicks — the tool handles field migration, payload validation, and safe publish (always PAUSED). It exists so media buyers can scale structure changes without touching Meta Ads Manager's dense interface.

## Brand Personality

Precise, efficient, professional. The tool respects the user's expertise — it does not over-explain, over-animate, or over-decorate. Every interaction should feel like it was built by someone who has managed Meta campaigns themselves.

## Anti-references

- **Meta Ads Manager**: cluttered, bureaucratic, dense grids with unclear hierarchy. AdSpawn should feel like the opposite — decisions are visible, actions are clear, state is unambiguous.
- **Developer tools (Vercel, Linear)**: too terminal-native and monochrome. AdSpawn is not a devtool; it has warmth from its blue accent and professional context, not the cold precision of a deploy dashboard.

## Design Principles

1. **Clarity over density.** Surface only what the user needs for the current action. Contrast with Ads Manager's everything-on-screen approach — progressive disclosure is always the right call.
2. **Control without ceremony.** Power-user features (bulk edit, objective conversion, wide creation) are accessible without burying them. No wizard fatigue; no confirmation dialogs for things that are already PAUSED.
3. **Trust through explicitness.** Statuses, IDs, and field names are shown exactly. No friendly euphemisms. The user knows the difference between a campaign objective and an optimization goal — the UI should too.
4. **Blue as signal, not decoration.** The blue accent marks interactive elements, active states, and primary actions — consistently. It should never appear as visual garnish.
5. **Speed as a quality.** Skeleton states, optimistic updates, and instant feedback are table stakes. The UI should feel as fast as the user's mental model of the operations they're performing.

## Accessibility & Inclusion

WCAG AA. Keyboard navigation for all primary flows, visible focus rings, sufficient contrast on interactive elements. The dark theme must not sacrifice legibility — muted grays should still meet 4.5:1 against their backgrounds. Reduced motion respect via `prefers-reduced-motion`.
