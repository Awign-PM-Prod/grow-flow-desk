-- Configurable NPS survey form (admin-managed questions) + JSON answers

CREATE TABLE public.nps_survey_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title TEXT NOT NULL DEFAULT 'Awign Feedback Survey',
  description TEXT NOT NULL DEFAULT 'All questions are required unless marked optional.',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.nps_survey_settings (id, title, description)
VALUES (
  1,
  'Awign Feedback Survey',
  'All questions are required. Please rate each item from 1 (Very Unsatisfied) to 5 (Very Satisfied) where applicable.'
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.nps_survey_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key TEXT NOT NULL UNIQUE,
  section_title TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL,
  input_type TEXT NOT NULL CHECK (
    input_type IN ('email', 'rating', 'short_text', 'long_text', 'single_choice')
  ),
  required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_nps_survey_questions_sort ON public.nps_survey_questions(sort_order);

-- Migrate legacy column answers into JSONB
ALTER TABLE public.nps_responses
  ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.nps_responses
SET answers = jsonb_build_object(
  'email', email,
  'satisfaction_services', satisfaction_services,
  'satisfaction_project_execution', satisfaction_project_execution,
  'gig_workforce_quality', gig_workforce_quality,
  'poc_overall_communication', poc_overall_communication,
  'poc_escalation_handling', poc_escalation_handling,
  'poc_availability', poc_availability,
  'poc_proactive_approach', poc_proactive_approach,
  'poc_timely_response', poc_timely_response,
  'poc_requirement_understanding', poc_requirement_understanding,
  'referral_intent', referral_intent,
  'leadership_meeting', leadership_meeting,
  'services_meet_needs', services_meet_needs,
  'improve_suggestions', improve_suggestions,
  'other_comments', other_comments
)
WHERE answers = '{}'::jsonb OR answers IS NULL;

ALTER TABLE public.nps_responses
  DROP COLUMN IF EXISTS satisfaction_services,
  DROP COLUMN IF EXISTS satisfaction_project_execution,
  DROP COLUMN IF EXISTS gig_workforce_quality,
  DROP COLUMN IF EXISTS poc_overall_communication,
  DROP COLUMN IF EXISTS poc_escalation_handling,
  DROP COLUMN IF EXISTS poc_availability,
  DROP COLUMN IF EXISTS poc_proactive_approach,
  DROP COLUMN IF EXISTS poc_timely_response,
  DROP COLUMN IF EXISTS poc_requirement_understanding,
  DROP COLUMN IF EXISTS referral_intent,
  DROP COLUMN IF EXISTS leadership_meeting,
  DROP COLUMN IF EXISTS services_meet_needs,
  DROP COLUMN IF EXISTS improve_suggestions,
  DROP COLUMN IF EXISTS other_comments;

-- Seed default form (only when empty)
INSERT INTO public.nps_survey_questions (field_key, section_title, label, input_type, required, sort_order, options, is_system)
SELECT * FROM (VALUES
  ('email', 'Contact Details', 'Email ID', 'email', true, 10, '[]'::jsonb, true),
  ('satisfaction_services', 'Service satisfaction', 'How satisfied are you with Awign''s services?', 'rating', true, 20, '[]'::jsonb, false),
  ('satisfaction_project_execution', 'Service satisfaction', 'How satisfied are you on Project Execution?', 'rating', true, 30, '[]'::jsonb, false),
  ('gig_workforce_quality', 'Service satisfaction', 'How do you rate Awign''s Gig Workforce Quality?', 'rating', true, 40, '[]'::jsonb, false),
  ('poc_overall_communication', 'How satisfied were your POC?', 'Overall Communication', 'rating', true, 50, '[]'::jsonb, false),
  ('poc_escalation_handling', 'How satisfied were your POC?', 'Escalation Handling', 'rating', true, 60, '[]'::jsonb, false),
  ('poc_availability', 'How satisfied were your POC?', 'Availability', 'rating', true, 70, '[]'::jsonb, false),
  ('poc_proactive_approach', 'How satisfied were your POC?', 'Proactive Approach', 'rating', true, 80, '[]'::jsonb, false),
  ('poc_timely_response', 'How satisfied were your POC?', 'Timely Response', 'rating', true, 90, '[]'::jsonb, false),
  ('poc_requirement_understanding', 'How satisfied were your POC?', 'Project Requirement Understanding', 'rating', true, 100, '[]'::jsonb, false),
  ('referral_intent', 'Additional questions', 'Would you refer Awign to other peer groups within or outside your organization?', 'single_choice', true, 110, '["Yes","No","Maybe"]'::jsonb, false),
  ('leadership_meeting', 'Additional questions', 'Have you met Awign''s Leadership?', 'single_choice', true, 120, '["Yes, We have Met Virtually","Yes, We have met personally","No"]'::jsonb, false),
  ('services_meet_needs', 'Additional questions', 'How well do our services meet your needs?', 'rating', true, 130, '[]'::jsonb, false),
  ('improve_suggestions', 'Additional questions', 'What can Awign do better?', 'long_text', true, 140, '[]'::jsonb, false),
  ('other_comments', 'Additional questions', 'Do you have any other comments, questions or concerns?', 'long_text', true, 150, '[]'::jsonb, false)
) AS v(field_key, section_title, label, input_type, required, sort_order, options, is_system)
WHERE NOT EXISTS (SELECT 1 FROM public.nps_survey_questions LIMIT 1);

ALTER TABLE public.nps_survey_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_survey_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view nps survey settings"
  ON public.nps_survey_settings FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can update nps survey settings"
  ON public.nps_survey_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can view nps survey questions"
  ON public.nps_survey_questions FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can insert nps survey questions"
  ON public.nps_survey_questions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can update nps survey questions"
  ON public.nps_survey_questions FOR UPDATE
  TO authenticated
  USING (public.is_admin_user(auth.uid()))
  WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete nps survey questions"
  ON public.nps_survey_questions FOR DELETE
  TO authenticated
  USING (public.is_admin_user(auth.uid()) AND is_system = false);
