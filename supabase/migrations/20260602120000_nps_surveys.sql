-- NPS survey: contact opt-in, invite tokens, and responses

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS nps_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_contacts_nps_enabled ON public.contacts(nps_enabled)
  WHERE nps_enabled = true;

CREATE TABLE public.nps_survey_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  submitted_at TIMESTAMP WITH TIME ZONE,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_nps_survey_invites_token ON public.nps_survey_invites(token);
CREATE INDEX idx_nps_survey_invites_contact_id ON public.nps_survey_invites(contact_id);

CREATE TABLE public.nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL UNIQUE REFERENCES public.nps_survey_invites(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,

  satisfaction_services SMALLINT NOT NULL CHECK (satisfaction_services BETWEEN 1 AND 5),
  satisfaction_project_execution SMALLINT NOT NULL CHECK (satisfaction_project_execution BETWEEN 1 AND 5),
  gig_workforce_quality SMALLINT NOT NULL CHECK (gig_workforce_quality BETWEEN 1 AND 5),

  poc_overall_communication SMALLINT NOT NULL CHECK (poc_overall_communication BETWEEN 1 AND 5),
  poc_escalation_handling SMALLINT NOT NULL CHECK (poc_escalation_handling BETWEEN 1 AND 5),
  poc_availability SMALLINT NOT NULL CHECK (poc_availability BETWEEN 1 AND 5),
  poc_proactive_approach SMALLINT NOT NULL CHECK (poc_proactive_approach BETWEEN 1 AND 5),
  poc_timely_response SMALLINT NOT NULL CHECK (poc_timely_response BETWEEN 1 AND 5),
  poc_requirement_understanding SMALLINT NOT NULL CHECK (poc_requirement_understanding BETWEEN 1 AND 5),

  referral_intent TEXT NOT NULL CHECK (referral_intent IN ('Yes', 'No', 'Maybe')),
  leadership_meeting TEXT NOT NULL CHECK (
    leadership_meeting IN (
      'Yes, We have Met Virtually',
      'Yes, We have met personally',
      'No'
    )
  ),
  services_meet_needs SMALLINT NOT NULL CHECK (services_meet_needs BETWEEN 1 AND 5),

  improve_suggestions TEXT NOT NULL,
  other_comments TEXT NOT NULL,

  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_nps_responses_contact_id ON public.nps_responses(contact_id);
CREATE INDEX idx_nps_responses_submitted_at ON public.nps_responses(submitted_at DESC);

ALTER TABLE public.nps_survey_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nps_responses ENABLE ROW LEVEL SECURITY;

-- Admins can view invites and responses
CREATE POLICY "Admins can view nps survey invites"
  ON public.nps_survey_invites FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can view nps responses"
  ON public.nps_responses FOR SELECT
  TO authenticated
  USING (public.is_admin_user(auth.uid()));
