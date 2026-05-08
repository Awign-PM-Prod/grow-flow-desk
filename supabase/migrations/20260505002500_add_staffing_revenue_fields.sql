do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'revenue_section_type'
      and n.nspname = 'public'
  ) then
    create type public.revenue_section_type as enum ('A', 'B', 'C');
  end if;
end $$;

alter table public.mandates
  add column if not exists revenue_section_type public.revenue_section_type,
  add column if not exists staffing_headcount numeric,
  add column if not exists staffing_salary_payouts numeric,
  add column if not exists staffing_program_management numeric,
  add column if not exists staffing_saas_usage_fee numeric,
  add column if not exists staffing_monthly_agency_fee_percent numeric,
  add column if not exists staffing_sales_force_automation_setup_fee numeric,
  add column if not exists staffing_recruitment_cost numeric,
  add column if not exists staffing_misc_recurring numeric,
  add column if not exists staffing_misc_one_time numeric,
  add column if not exists staffing_active_months_per_year integer,
  add column if not exists staffing_gm_percent numeric,
  add column if not exists staffing_current_fycv numeric;

alter table public.mandates
  add column if not exists staffing_b_num_stores numeric,
  add column if not exists staffing_b_cost_per_store numeric,
  add column if not exists staffing_b_mcv numeric,
  add column if not exists staffing_b_acv numeric,
  add column if not exists staffing_b_current_fycv numeric;

alter table public.mandates
  add column if not exists staffing_c_one_time_setup_fee numeric,
  add column if not exists staffing_c_retainership_fee numeric,
  add column if not exists staffing_c_hosting_maintenance numeric,
  add column if not exists staffing_c_call_center_management numeric,
  add column if not exists staffing_c_reward_value numeric,
  add column if not exists staffing_c_rewards_redemption_fee_percent numeric,
  add column if not exists staffing_c_misc_recurring numeric,
  add column if not exists staffing_c_misc_one_time numeric,
  add column if not exists staffing_c_mcv numeric,
  add column if not exists staffing_c_acv numeric,
  add column if not exists staffing_c_current_fycv numeric;

alter table public.mandates
  drop constraint if exists mandates_revenue_section_type_check;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'mandates'
      and column_name = 'revenue_section_type'
      and udt_name <> 'revenue_section_type'
  ) then
    alter table public.mandates
      alter column revenue_section_type type public.revenue_section_type
      using revenue_section_type::public.revenue_section_type;
  end if;
end $$;
