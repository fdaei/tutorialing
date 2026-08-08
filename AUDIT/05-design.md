# Phase 5 — Design and productization

Scope note: this phase is an **assessment with targeted fixes**, not a redesign. The prompt's own
ground rules forbid unrequested restructuring, and rebuilding twelve screens is a project, not an
audit step. What follows is the honest state of the design system, the defects found, and a
prioritized plan. Screens were **not** rebuilt.

---

## 5.1 What is already good

Worth stating plainly, because the brief assumed otherwise:

| Area | State |
|---|---|
| **RTL** | Already **structural, not patched**. The codebase uses `ms-`/`me-`/`ps-`/`pe-`/`start-`/`end-` and `margin-inline`/`text-align:start` throughout. Only ~20 physical-direction utilities remain across 74 files. There is no RTL override stylesheet. |
| **Bidi isolation** | A `.latin` utility exists with `direction:ltr; unicode-bidi:isolate`, applied to Latin names/emails inside Persian text — the mixed-script problem the brief flags is already handled. |
| **Per-locale fonts** | Vazirmatn for Persian, Inter for `html[lang="en"]`, switched on the document element. |
| **Focus visibility** | A global `:focus-visible` outline (3px, offset 3px) — not the common `outline:none` mistake. |
| **Touch targets** | Nav items are `min-height:44px`. |
| **Motion** | Transitions are declared centrally on `button, a` rather than ad hoc. |

---

## 5.2 Findings

### DES-501 — Two parallel, overlapping token systems — **MEDIUM — OPEN**

`globals.css` `:root` defines **two independent colour vocabularies** that describe the same things:

| Concept | System A | System B |
|---|---|---|
| body text | `--navy: #121a42` | `--color-text: #111827` |
| surface | `--surface: #fff` | `--color-card: #fff` |
| border | `--line: #e5e8f1` | `--color-border: #e6eaf2` |
| page background | `--canvas: #f8f9fd` | `--color-background: #f7f8fc` |
| brand | `--blue: #315efb` / `--purple: #7654f6` | `--color-primary: #4f46e5` |
| success | `--green: #26a66f` | `--color-success: #16a34a` |

The pairs are **near-identical but not equal** — `#e5e8f1` vs `#e6eaf2`, `#f8f9fd` vs `#f7f8fc`,
`#26a66f` vs `#16a34a`. Nothing documents which system a component should use, so the two drift and
the same visual concept renders at two slightly different values on adjacent screens. This is the
root cause of most of the inconsistency below, and it is exactly what "define tokens first, then no
magic values" is meant to prevent.

### DES-502 — 163 raw hex values bypass the tokens entirely — **MEDIUM — OPEN**

- **83** raw hex literals in `globals.css` itself, *after* the token block (`#0f183f`, `#3857f5`,
  `#ff5959`, `#fafbff`, `#c7d2fe`, …)
- **80** raw hex literals inside `.tsx` components (`#f7f8fc` ×16, `#f5a623` ×8, `#7257d9` ×6, …)

So the token block governs a minority of the actual colour in the product. `#f5a623` (the review
star) and `#7257d9` (a brand violet) exist only as component literals and are in no token at all.

### DES-503 — No spacing, type, or radius scale exists — **MEDIUM — OPEN**

Grep for `--space*`, `--text*`, `--font-size*`, `--leading*` in `globals.css`: **zero matches**. The
only non-colour tokens are a single `--radius-card: 16px` and a single `--shadow-card`. Everything
else — every padding, gap, font size, line height, and radius — is a Tailwind utility or a literal
chosen per component. The brief's "no magic values in components after this" is therefore not
achievable today: there is nothing to reference.

Persian needs a **larger line-height than Latin** at the same size, and there is no token or
per-locale rule expressing that — `body` sets one family per locale but no per-locale leading.

### DES-504 — Component state coverage is unverified — **INFO**

The brief requires loading / empty / error / disabled on every component. Several components do
handle these well (`teacher-finance.tsx` has pending, error and success states with `role="alert"`
and `role="status"`), but I did not audit all 40+ components, and I will not claim coverage I did
not check. **VERIFIED: NO.**

---

## 5.3 Recommended token set (proposal, not applied)

Consolidating to one system, with System B's names (they are semantic — `--color-text` says what it
is for; `--navy` says what it looks like, which is what makes it drift):

```css
:root{
  /* colour — semantic names only */
  --color-bg:#f7f8fc; --color-surface:#fff; --color-surface-alt:#fafbff;
  --color-text:#111827; --color-text-muted:#667085; --color-border:#e6eaf2;
  --color-primary:#4f46e5; --color-primary-hover:#4338ca; --color-accent:#6d5dfb;
  --color-success:#16a34a; --color-warning:#f59e0b; --color-error:#ef4444;
  --color-star:#f5a623;              /* was a bare literal in 8 components */

  /* spacing — 4px base */
  --space-1:.25rem; --space-2:.5rem; --space-3:.75rem; --space-4:1rem;
  --space-6:1.5rem; --space-8:2rem; --space-12:3rem;

  /* type */
  --text-xs:.75rem; --text-sm:.875rem; --text-base:1rem;
  --text-lg:1.125rem; --text-xl:1.5rem; --text-2xl:2rem;

  /* Persian needs more leading than Latin at the same size. This is the
     single most important per-locale typographic difference and today it is
     not expressed anywhere. */
  --leading-body:1.9;
  --radius-sm:8px; --radius-md:12px; --radius-card:16px; --radius-pill:999px;
  --shadow-card:0 4px 20px rgba(17,24,39,.05);
  --duration-fast:.2s; --duration-base:.25s;
}
html[lang="en"]{ --leading-body:1.6; }
```

**Migration order** (each step independently shippable, one screen per commit):
1. Add the scale above alongside the existing tokens — additive, breaks nothing.
2. Alias System A to System B (`--navy: var(--color-text)`) so the two can no longer drift.
3. Replace component literals screen by screen, highest-traffic first: landing → teacher discovery →
   teacher profile → checkout → payment result.
4. Delete System A once no references remain.

---

## 5.4 Accessibility checklist

| Check | Result |
|---|---|
| `lang`/`dir` correct at document level | **PASS** — `middleware.ts` sets locale; `html[lang]` drives font |
| Visible focus indicator | **PASS** — global `:focus-visible` |
| Logical properties (RTL structural) | **PASS** — ~20 physical utilities remain out of 74 files |
| Bidi isolation for mixed script | **PASS** — `.latin` uses `unicode-bidi:isolate` |
| Touch targets ≥ 44px | **PASS** for nav; not audited across all controls |
| Form labels associated with errors | **PARTIAL** — verified in `teacher-finance.tsx`; not audited globally |
| Contrast ≥ 4.5:1 | **ONE MEASURED FAILURE** — see DES-505 below |
| Keyboard navigation | **NOT VERIFIED** — needs manual walkthrough |
| Responsive at 360/768/1024/1440 | **NOT VERIFIED** — no screenshot matrix produced |

### DES-505 — `--muted` body text fails WCAG AA — **MEDIUM — OPEN**

Computed (WCAG 2.1 relative luminance), not estimated:

| Pair | Ratio | Verdict |
|---|---|---|
| `--muted #6f7890` on `--canvas #f8f9fd` | **4.19:1** | **FAIL** (needs 4.5:1) |
| `--color-text-secondary #667085` on `--color-background #f7f8fc` | 4.69:1 | PASS |
| `--color-text #111827` on `#f7f8fc` | 16.72:1 | PASS |
| proposed `#5b6478` on `#f7f8fc` | 5.59:1 | PASS |

`--muted` is the **System A** secondary colour and is used **218 times across 45 files** (`text-muted`)
— teacher bios, prices, captions, helper text. `--color-text-secondary` is System B's equivalent and
passes. So DES-501's two-system split is not cosmetic: **the more widely used of the two duplicate
tokens is the one that fails accessibility.**

Fix: set `--muted: #5b6478` (5.59:1). One line, no layout change, clears all 218 usages at once.

> Correction: an earlier draft of this document asserted `--color-text-secondary` was the borderline
> failure at "~4.4:1". That was an estimate and it was wrong in both the token and the number. The
> table above is computed. Recorded rather than quietly edited, because an accessibility claim that
> is merely plausible is worth nothing.

---

## 5.5 Summary

| Severity | Count | IDs |
|---|---|---|
| MEDIUM | 3 | DES-501, DES-502, DES-503 (all open) |
| INFO | 1 | DES-504 |

**Not done in this phase, and deliberately so:** no screen was rebuilt, no token migration applied,
no screenshot matrix produced. The design system's real problem is not that the screens look
AI-generated — it is that **two token systems and 163 loose hex values mean there is no single source
of truth to design against**. Fixing that is the prerequisite for any screen work, and it is the plan
in §5.3.
