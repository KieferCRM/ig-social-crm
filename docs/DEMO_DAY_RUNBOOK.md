# ShadowHive Demo-Day Runbook (Off-Market Agent)

## Goal
Show that ShadowHive can replace day-to-day lead tracking with fast intake, clear pipeline visibility, and reliable follow-up.

## Pre-Call (15-20 minutes before)
1. Start app: `npm run dev`
2. Open and verify:
- `/app`
- `/app/import`
- `/app/kanban`
- `/app/reminders`
3. Confirm no runtime errors in terminal/browser console.
4. Keep this sample file ready: `docs/sample-import-fub.csv`.

## Demo Narrative (10-15 minutes)
1. Dashboard first:
- Show Total Leads, Hot Leads, Closed metrics.
- Click Hot/Closed preview blocks.
2. Manual intake:
- Go to lead list and add a manual lead.
- Explain this covers referrals, open house walk-ins, and text/call leads.
3. CSV intake:
- Import `docs/sample-import-fub.csv`.
- Highlight inserted/updated/skipped results.
4. Pipeline workflow:
- Open Kanban and move one lead from New -> Contacted.
- Show this as the daily operating board.
5. Reminder workflow:
- Create reminder on one lead.
- Mark reminder as done.
- Explain this prevents missed follow-up.

## What To Ask Her
1. Which fields are non-negotiable in your current workflow?
2. What are your stage names today (if different from current ones)?
3. What follow-up cadence do you use for hot vs warm leads?
4. What export from FollowUpBoss can you share first (10-20 rows)?

## Validation Checklist During Call
- Import succeeds without schema/header errors.
- Duplicate import updates existing lead instead of creating a duplicate.
- Lead movement in Kanban works.
- Reminder create/update works.
- No blocking error banners.

## Fallback If Import Fails Live
1. Continue demo with manual lead add.
2. Show Kanban movement and reminders.
3. Ask for a small CSV and promise same-day mapping patch.

## Post-Call Action List
1. Capture her exact CSV header row.
2. Patch any missing header aliases.
3. Re-run import with her sample file.
4. Send her a short confirmation note with what is already working and what was adjusted.
