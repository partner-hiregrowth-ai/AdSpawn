---
target: frontend/src/app/dashboard/page.tsx
total_score: 25
p0_count: 0
p1_count: 3
timestamp: 2026-06-02T03-58-00Z
slug: frontend-src-app-dashboard-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeletons and toasts work well; no global progress indicator |
| 2 | Match System / Real World | 3 | Meta terminology correct for experts; "Wide Create" is unexplained jargon |
| 3 | User Control and Freedom | 2 | Draft system is a strong safety net; no undo/revert once published |
| 4 | Consistency and Standards | 3 | Solid dark system; gradient text on navbar logo is the single inconsistency |
| 5 | Error Prevention | 3 | PAUSED-by-default and pre-publish validation are excellent; no autosave visible |
| 6 | Recognition Rather Than Recall | 2 | Sidebar loses all labels when collapsed; no keyboard shortcuts; no tooltips |
| 7 | Flexibility and Efficiency | 3 | Bulk publish, bulk edit, bulk delete present; no keyboard shortcuts or command palette |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and focused; gradient text logo and stagger delay on 6th card are unnecessary |
| 9 | Error Recovery | 2 | Toast messages are contextual; no inline form validation observed; recovery path unclear |
| 10 | Help and Documentation | 1 | No in-app help, tooltips, or onboarding flow anywhere |
| **Total** | | **25/40** | **Acceptable** |

## Anti-Patterns Verdict

Gradient text on navbar (every page), 18 gray-on-color contrast failures, 1 layout-transition animation.

## Priority Issues

[P1] Gradient text on every authenticated page — Navbar.tsx:45, fix with text-[#60a5fa]
[P1] Reveal animations gate content visibility — opacity-0 animate-fade-in-up, no prefers-reduced-motion
[P1] Systematic gray-on-color (18 instances) — 9 files, replace with white or blue-100
[P2] Sidebar collapsed drops all labels — add Radix Tooltip to collapsed nav items
[P2] No help, contextual hints, or onboarding

## Persona Red Flags

Alex (Power User): No keyboard shortcuts, stagger animation delay, collapsed sidebar loses labels.
Sam (Accessibility): No prefers-reduced-motion, opacity-0 gate, no aria-current="page" on active nav.
Maya (Agency Buyer): No account search/filter, no favorites or recently-used.
