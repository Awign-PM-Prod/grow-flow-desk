-- Staffing mandates: add persisted gross margin and Type C monthly recurring fees;
-- remove Current FYCV columns and legacy Type C breakdown columns.
-- Gross margin values are calculated in the application only (no SQL formula or backfill).

alter table public.mandates
  add column if not exists staffing_gross_margin numeric,
  add column if not exists staffing_c_monthly_recurring_fees numeric;

alter table public.mandates
  drop column if exists staffing_current_fycv,
  drop column if exists staffing_b_current_fycv,
  drop column if exists staffing_c_current_fycv,
  drop column if exists staffing_c_retainership_fee,
  drop column if exists staffing_c_hosting_maintenance,
  drop column if exists staffing_c_call_center_management,
  drop column if exists staffing_c_reward_value,
  drop column if exists staffing_c_rewards_redemption_fee_percent,
  drop column if exists staffing_c_misc_recurring,
  drop column if exists staffing_c_misc_one_time,
  drop column if exists staffing_c_mcv,
  drop column if exists staffing_c_acv;
