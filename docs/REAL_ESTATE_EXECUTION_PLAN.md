# ShadowHive Real Estate Execution Plan

## Product Positioning
ShadowHive is an AI follow-up CRM for high-DM real estate agents.  
It must work even if social APIs are unavailable.

## Non-Negotiable Core
1. Lead capture without social dependency
- Manual lead entry
- CSV import/export
- Optional webhook/Zapier intake
2. Pipeline control
- Stage management
- Hot/Warm/Cold visibility
- List + Kanban + dashboard summary
3. Follow-up reliability
- Reminder creation/completion
- Overdue and stale lead surfacing
4. Booking progression
- Clear next-step prompts
- Appointment flow tied to lead

## Phase 1 (Current + Immediate)
1. Keep dashboard as command center.
2. Use Automation Settings to configure qualification prompts.
3. Use presets for off-market buyer/seller scripts.
4. Validate FollowUpBoss sample import with 10-20 row file.

## Phase 2 (No Meta Dependency)
1. Rule engine for agent-defined automations:
- Trigger: `lead_created`, `stage_changed`, `lead_temp_changed`, `reminder_overdue`
- Conditions: stage/temp/source/inactive-days
- Actions: create reminder, update stage, set next step, generate suggested reply
2. Daily briefing panel:
- Top leads to contact
- Overdue reminders
- Stale opportunities
3. Booking automation:
- Auto-send booking message template when lead is hot + qualified

## Phase 3 (Channel Connectors)
1. Meta connector (if approved)
2. Email/SMS connector alternatives
3. Unified conversation timeline across channels

## Demo Success Criteria (Client Pilot)
1. Import works from FollowUpBoss sample.
2. Agent can run daily workflow from dashboard in under 10 minutes.
3. At least one automated follow-up reminder path saves a missed lead.
4. Booking step is clear and repeatable.

## Risk Controls
1. Never require one platform to function.
2. Keep core CRM workflows channel-agnostic.
3. Treat social messaging as a connector, not the product foundation.
