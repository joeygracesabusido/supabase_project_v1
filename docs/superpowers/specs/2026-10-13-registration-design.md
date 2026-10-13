# Registration (Supabase Auth) — Design

Date: 2026-10-13
Approach: A — Backend Auth + simple form (approved)

## Problem
No registration exists. Backend `login` is a mock (`return f"Logged in as {email}"`, no password check). `Query.me` returns arbitrary first row from `users` table. Frontend `App.tsx` is stock CRA, not wired to backend.

## Architecture
Keep existing stack. No new deps, no routing, no session store.
- Backend: FastAPI + strawberry GraphQL at `/graphql` (port 8000), uses `supabase.auth`.
- Frontend: CRA React + `@apollo/client` (already installed) pointed at `http://localhost:8000/graphql`.

## Components
1. `backend/main.py`
   - Add `Mutation.register(email: str, password: str) -> User` via `supabase.auth.sign_up({"email": email, "password": password})`.
   - Fix `Mutation.login(email: str, password: str) -> User` to use `supabase.auth.sign_in_with_password(...)` instead of mock string.
   - Both raise `Exception` on Supabase error so GraphQL surfaces it; return `User(id, email)`.
   - Leave `Query.me` untouched (out of scope).
2. `frontend/src/App.tsx` (replace template)
   - `ApolloClient({ uri: "http://localhost:8000/graphql", cache: InMemoryCache })` + `ApolloProvider`.
   - Single form: email + password inputs, Register/Login toggle, `useMutation(REGISTER | LOGIN)`, states for loading/error/success (show logged-in email).
   - Minimal required + minLength(6) validation only; reuse existing `App.css`.
3. `frontend/src/App.test.tsx`
   - Update: broken CRA default test replaced with register-form renders test.

## Data flow
Form submit → GraphQL mutation → `supabase.auth.*` → `User{id, email}` or error → UI shows result. No token stored client-side.

## Error handling
- Backend: try/except around auth calls, raise with Supabase message.
- Frontend: display `error.message`; disable submit while loading; empty-field guard.

## Testing
- Backend: manual `register` then `login` via GraphQL playground/curl; error case (duplicate email, wrong password).
- Frontend: updated `App.test.tsx` (renders email/password/register); manual `npm start` + backend run, register a real Supabase user.
- Existing tests: `CI=true npm test -- --watchAll=false`.

## Out of scope (YAGNI)
Session persistence/JWT storage, password reset, profile fields, route guards, fixing `me`. `backend/.env` must hold real `SUPABASE_URL`/`SUPABASE_KEY`.

## Risks
- `me` still returns first user (data exposure) — untouched by design.
- No persisted session: refresh loses login state. Upgrade when real sessions needed: store Supabase session + guard `me`.
- Requires real Supabase project + `users` table for `me` (register itself uses Auth, not the table).
