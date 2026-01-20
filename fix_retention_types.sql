-- Fix retention_type for all mandates based on the decision tree logic
-- This query implements the complete retention type calculation flow
-- Note: upsell_constraint is stored as ENUM ('YES', 'NO'), not boolean

UPDATE public.mandates
SET retention_type = CASE
    -- Level 1: If Mandate Health is "Need Improvement" → NI
    WHEN mandate_health = 'Need Improvement' THEN 'NI'
    
    -- Level 2: If Mandate Health is "Exceeds Expectations" or "Meets Expectations"
    WHEN mandate_health IN ('Exceeds Expectations', 'Meets Expectations') THEN
        CASE
            -- If Upsell Constraint is YES → E
            WHEN upsell_constraint = 'YES' THEN 'E'
            
            -- Level 3: If Upsell Constraint is NO, check Client Budget Trend and Awign Share %
            WHEN upsell_constraint = 'NO' AND client_budget_trend IS NOT NULL AND awign_share_percent IS NOT NULL THEN
                CASE
                    -- Client Budget Trend = "Increase"
                    WHEN client_budget_trend = 'Increase' THEN
                        CASE
                            WHEN awign_share_percent = '70% & Above' THEN 'A'
                            WHEN awign_share_percent = 'Below 70%' THEN 'B'
                            ELSE NULL
                        END
                    
                    -- Client Budget Trend = "Same"
                    WHEN client_budget_trend = 'Same' THEN
                        CASE
                            WHEN awign_share_percent = '70% & Above' THEN 'Star'
                            WHEN awign_share_percent = 'Below 70%' THEN 'C'
                            ELSE NULL
                        END
                    
                    -- Client Budget Trend = "Decrease" → D (regardless of Awign Share %)
                    WHEN client_budget_trend = 'Decrease' THEN 'D'
                    
                    ELSE NULL
                END
            
            -- If Upsell Constraint is NULL or other conditions not met, set to NULL
            ELSE NULL
        END
    
    -- If Mandate Health is NULL or other value, set to NULL
    ELSE NULL
END
WHERE 
    -- Only update mandates where retention_type needs to be corrected
    -- This ensures we don't unnecessarily update records that are already correct
    (
        -- Case 1: Mandate Health = "Need Improvement" but retention_type != 'NI'
        (mandate_health = 'Need Improvement' AND retention_type != 'NI')
        
        OR
        
        -- Case 2: Upsell Constraint = YES but retention_type != 'E'
        (mandate_health IN ('Exceeds Expectations', 'Meets Expectations') 
         AND upsell_constraint = 'YES' 
         AND retention_type != 'E')
        
        OR
        
        -- Case 3: Upsell Constraint = NO but retention_type doesn't match the matrix
        (mandate_health IN ('Exceeds Expectations', 'Meets Expectations') 
         AND upsell_constraint = 'NO' 
         AND client_budget_trend IS NOT NULL 
         AND awign_share_percent IS NOT NULL
         AND (
             -- Should be 'A' but isn't
             (client_budget_trend = 'Increase' AND awign_share_percent = '70% & Above' AND retention_type != 'A')
             OR
             -- Should be 'B' but isn't
             (client_budget_trend = 'Increase' AND awign_share_percent = 'Below 70%' AND retention_type != 'B')
             OR
             -- Should be 'Star' but isn't
             (client_budget_trend = 'Same' AND awign_share_percent = '70% & Above' AND retention_type != 'Star')
             OR
             -- Should be 'C' but isn't
             (client_budget_trend = 'Same' AND awign_share_percent = 'Below 70%' AND retention_type != 'C')
             OR
             -- Should be 'D' but isn't
             (client_budget_trend = 'Decrease' AND retention_type != 'D')
         ))
        
        OR
        
        -- Case 4: Mandate Health is set but retention_type is NULL and should be calculated
        (mandate_health IS NOT NULL 
         AND retention_type IS NULL
         AND (
             mandate_health = 'Need Improvement'
             OR
             (mandate_health IN ('Exceeds Expectations', 'Meets Expectations') 
              AND upsell_constraint IS NOT NULL
              AND (upsell_constraint = 'YES' 
                   OR (upsell_constraint = 'NO' 
                       AND client_budget_trend IS NOT NULL 
                       AND awign_share_percent IS NOT NULL)))
         ))
    );

-- Optional: View the results before and after
-- Run this query first to see what will be changed:
/*
SELECT 
    id,
    project_code,
    project_name,
    mandate_health,
    upsell_constraint,
    client_budget_trend,
    awign_share_percent,
    retention_type AS current_retention_type,
    CASE
        WHEN mandate_health = 'Need Improvement' THEN 'NI'
        WHEN mandate_health IN ('Exceeds Expectations', 'Meets Expectations') THEN
            CASE
                WHEN upsell_constraint = 'YES' THEN 'E'
                WHEN upsell_constraint = 'NO' AND client_budget_trend IS NOT NULL AND awign_share_percent IS NOT NULL THEN
                    CASE
                        WHEN client_budget_trend = 'Increase' AND awign_share_percent = '70% & Above' THEN 'A'
                        WHEN client_budget_trend = 'Increase' AND awign_share_percent = 'Below 70%' THEN 'B'
                        WHEN client_budget_trend = 'Same' AND awign_share_percent = '70% & Above' THEN 'Star'
                        WHEN client_budget_trend = 'Same' AND awign_share_percent = 'Below 70%' THEN 'C'
                        WHEN client_budget_trend = 'Decrease' THEN 'D'
                        ELSE NULL
                    END
                ELSE NULL
            END
        ELSE NULL
    END AS should_be_retention_type
FROM public.mandates
WHERE 
    mandate_health IS NOT NULL
    AND (
        -- Find mandates with incorrect retention types
        (mandate_health = 'Need Improvement' AND retention_type != 'NI')
        OR
        (mandate_health IN ('Exceeds Expectations', 'Meets Expectations') AND upsell_constraint = 'YES' AND retention_type != 'E')
        OR
        (mandate_health IN ('Exceeds Expectations', 'Meets Expectations') 
         AND upsell_constraint = 'NO' 
         AND client_budget_trend IS NOT NULL 
         AND awign_share_percent IS NOT NULL
         AND retention_type != CASE
             WHEN client_budget_trend = 'Increase' AND awign_share_percent = '70% & Above' THEN 'A'
             WHEN client_budget_trend = 'Increase' AND awign_share_percent = 'Below 70%' THEN 'B'
             WHEN client_budget_trend = 'Same' AND awign_share_percent = '70% & Above' THEN 'Star'
             WHEN client_budget_trend = 'Same' AND awign_share_percent = 'Below 70%' THEN 'C'
             WHEN client_budget_trend = 'Decrease' THEN 'D'
             ELSE NULL
         END)
    )
ORDER BY project_code;
*/

