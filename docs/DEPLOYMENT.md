# IG Social CRM V1 Deployment Checklist

## 1) Vercel Setup
- [ ] Connect the Git repository in Vercel.
- [ ] Set the project root to the repository root.
- [ ] Confirm build command is `next build`.
- [ ] Confirm output is standard Next.js output (no custom output dir required).
- [ ] Deploy to a preview environment first.
- [ ] Promote to production only after the validation checklist passes.

## 2) Required Environment Variables
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`

If using server routes and middleware with Supabase SSR, verify the same values are present in Vercel Production, Preview, and Development env scopes as needed.

## 3) Supabase Auth Redirect URL Notes
- [ ] In Supabase Auth URL configuration, set production Site URL to the production domain.
- [ ] Add production callback/redirect URLs used by the app.
- [ ] Remove any localhost URLs from production redirect configuration.
- [ ] Keep localhost redirects only for local development projects/environments.

## 4) Post-Deploy Validation
- [ ] Auth login/signup works on production domain.
- [ ] Session persistence works across refresh/navigation.
- [ ] RLS verified: user can only read/write own leads (`agent_id = auth.uid()`).
- [ ] `ig_progress` ingestion works against production function URL.
- [ ] Ingestion idempotency verified (same `(agent_id, ig_username)` updates, no duplicates).
- [ ] Logout works and protected routes redirect correctly.
- [ ] Kanban drag/drop updates stage and `time_last_updated`.
- [ ] Lead detail panel autosave works (`Saving...`, `Saved`, `Error`).
- [ ] CSV import works at `/app/import` with summary counts and error rows.
