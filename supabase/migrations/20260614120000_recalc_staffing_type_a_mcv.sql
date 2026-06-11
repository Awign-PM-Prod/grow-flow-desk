-- Recalculate staffing revenue type A MCV using updated formula:
-- MCV = Headcount × (Salary & Payouts + SaaS Usage Fee) + Program Management
--     + (Headcount × (Salary & Payouts + SaaS Usage Fee) + Program Management) × Agency Fee % / 100
--     + Headcount × Misc Recurring
-- ACV and staffing_gross_margin are derived from the new MCV.

WITH type_a_mandates AS (
  SELECT
    m.id,
    COALESCE(m.staffing_headcount, 0) AS headcount,
    COALESCE(m.staffing_salary_payouts, 0) AS salary_payouts,
    COALESCE(m.staffing_program_management, 0) AS program_management,
    COALESCE(m.staffing_saas_usage_fee, 0) AS saas_usage_fee,
    COALESCE(m.staffing_monthly_agency_fee_percent, 0) AS agency_fee_percent,
    COALESCE(m.staffing_misc_recurring, 0) AS misc_recurring,
    COALESCE(m.staffing_sales_force_automation_setup_fee, 0) AS sfa_setup,
    COALESCE(m.staffing_recruitment_cost, 0) AS recruitment_cost,
    COALESCE(m.staffing_misc_one_time, 0) AS misc_one_time,
    COALESCE(m.staffing_active_months_per_year, 0) AS active_months,
    COALESCE(m.staffing_gm_percent, 0) AS gm_percent
  FROM public.mandates m
  WHERE m.revenue_section_type = 'A'::public.revenue_section_type
     OR (
       m.revenue_section_type IS NULL
       AND (
         lower(trim(m.use_case::text)) IN ('staffing', 'staffing - core')
         OR (
           lower(trim(m.use_case::text)) = 'retail branding'
           AND lower(trim(m.sub_use_case::text)) = 'merchandiser driven programs'
         )
       )
     )
),
recalc AS (
  SELECT
    id,
    round(
      headcount * (salary_payouts + saas_usage_fee) + program_management
      + (headcount * (salary_payouts + saas_usage_fee) + program_management) * agency_fee_percent / 100
      + headcount * misc_recurring,
      2
    ) AS new_mcv,
    headcount,
    sfa_setup,
    recruitment_cost,
    misc_one_time,
    active_months,
    gm_percent
  FROM type_a_mandates
),
with_acv AS (
  SELECT
    id,
    new_mcv,
    round(
      new_mcv * active_months
      + (sfa_setup + recruitment_cost) * headcount
      + misc_one_time,
      2
    ) AS new_acv,
    gm_percent
  FROM recalc
)
UPDATE public.mandates m
SET
  revenue_mcv = w.new_mcv,
  revenue_acv = w.new_acv,
  staffing_gross_margin = round(w.new_acv * w.gm_percent / 100, 2),
  revenue_section_type = COALESCE(m.revenue_section_type, 'A'::public.revenue_section_type)
FROM with_acv w
WHERE m.id = w.id;
