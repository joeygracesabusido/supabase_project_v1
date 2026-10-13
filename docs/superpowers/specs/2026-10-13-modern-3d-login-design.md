# Modern 3D Auth Page (Tailwind) — Design

Date: 2026-10-13
Approach: Mouse-follow tilt + glassmorphism, Tailwind v4 only (approved)

## Problem
`frontend/src/App.tsx` uses inline styles and looks like a default form. We want a modern login/registration page with a 3D effect, styled with Tailwind CSS, without losing the working register/login auth.

## Constraints / decisions
- Keep both Register + Login flows and the real Apollo → backend wiring (no dead UI).
- TypeScript throughout (already the case).
- Add Tailwind only; no other new runtime dependencies (no framer-motion).

## Architecture
Keep the existing stack. Add **Tailwind CSS v4** via the official `@tailwindcss/vite` plugin:
- No `postcss.config`, no `tailwind.config.js`, no autoprefixer — the Vite plugin handles it.
- Register the plugin in `vite.config.ts`; add a single `src/index.css` with `@import "tailwindcss";` plus a few `@keyframes`.

No backend changes. GraphQL schema and mutations are untouched.

## Components
1. `frontend/src/components/TiltCard.tsx` (new) — the 3D wrapper, one job: tilt its children toward the cursor.
   - Parent sets `perspective`; inner element uses `transform-style: preserve-3d`.
   - On mousemove over the card: compute cursor offset from center → set CSS vars `--rx`, `--ry` (max ~8°) applied as `transform: rotateX(var(--rx)) rotateY(var(--ry))`; also `--mx/--my` for a soft glare highlight that follows the cursor.
   - On mouseleave: reset to 0 with a transition. Children use `translateZ()` for layered depth.
2. `frontend/src/App.tsx` — keep `ApolloProvider`, the register/login toggle, and ALL Apollo mutation logic unchanged; rewrite only the markup with Tailwind classes and wrap the form in `<TiltCard>`. Background: 2–3 blurred floating gradient orbs (pure CSS animation) for depth.
   - Glass card: `bg-white/10 backdrop-blur-xl border border-white/20`, rounded, subtle animated glow border.

## Data flow (unchanged)
Form submit → `useMutation(REGISTER | LOGIN)` → `http://localhost:8000/graphql` → Supabase auth → `User{id,email}` or error → UI shows result. No token stored client-side.

## Error handling (unchanged)
Show `error.message`; disable submit while loading; empty-field + minLength(6) guard.

## Testing
- Keep the existing render test: email/password fields + register heading still findable inside the tilt wrapper.
- Add one test: clicking "Sign in instead" flips the heading to "Sign in".
- No new test dependencies.

## Files touched
- `frontend/package.json` — add `tailwindcss`, `@tailwindcss/vite`.
- `frontend/vite.config.ts` — add Tailwind plugin.
- `frontend/src/index.css` (new) — `@import "tailwindcss";` + keyframes (orb float, glow pulse).
- `frontend/src/main.tsx` — import `./index.css`.
- `frontend/src/App.tsx` — Tailwind restyle + wrap in `TiltCard`.
- `frontend/src/components/TiltCard.tsx` (new) — 3D tilt wrapper.
- `frontend/src/App.test.tsx` — keep render test, add toggle test.

## Out of scope (YAGNI)
Routing/pages, framer-motion, parallax-scene variant, backend changes, session/JWT persistence, password reset, responsive-breakpoint polish beyond a sensible mobile default.
