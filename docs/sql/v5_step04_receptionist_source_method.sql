-- v5_step04: Add 'receptionist' as an allowed value for first/latest_source_method
-- The check constraint currently only allows: webhook, api, manual, import, unknown
-- Receptionist (voice + SMS) is a distinct inbound channel and needs its own value.

alter table leads
  drop constraint if exists leads_first_source_method_check;

alter table leads
  add constraint leads_first_source_method_check
    check (first_source_method in ('webhook','api','manual','import','unknown','receptionist'));

alter table leads
  drop constraint if exists leads_latest_source_method_check;

alter table leads
  add constraint leads_latest_source_method_check
    check (latest_source_method in ('webhook','api','manual','import','unknown','receptionist'));
