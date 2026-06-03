export const NPS_REFERRAL_OPTIONS = ["Yes", "No", "Maybe"] as const;
export type NpsReferralIntent = (typeof NPS_REFERRAL_OPTIONS)[number];

export const NPS_LEADERSHIP_OPTIONS = [
  "Yes, We have Met Virtually",
  "Yes, We have met personally",
  "No",
] as const;
export type NpsLeadershipMeeting = (typeof NPS_LEADERSHIP_OPTIONS)[number];

export const POC_SATISFACTION_FIELDS = [
  { key: "poc_overall_communication", label: "Overall Communication" },
  { key: "poc_escalation_handling", label: "Escalation Handling" },
  { key: "poc_availability", label: "Availability" },
  { key: "poc_proactive_approach", label: "Proactive Approach" },
  { key: "poc_timely_response", label: "Timely Response" },
  { key: "poc_requirement_understanding", label: "Project Requirement Understanding" },
] as const;

export type NpsFormState = {
  email: string;
  satisfaction_services: number | null;
  satisfaction_project_execution: number | null;
  gig_workforce_quality: number | null;
  poc_overall_communication: number | null;
  poc_escalation_handling: number | null;
  poc_availability: number | null;
  poc_proactive_approach: number | null;
  poc_timely_response: number | null;
  poc_requirement_understanding: number | null;
  referral_intent: NpsReferralIntent | "";
  leadership_meeting: NpsLeadershipMeeting | "";
  services_meet_needs: number | null;
  improve_suggestions: string;
  other_comments: string;
};

export const emptyNpsFormState = (email = ""): NpsFormState => ({
  email,
  satisfaction_services: null,
  satisfaction_project_execution: null,
  gig_workforce_quality: null,
  poc_overall_communication: null,
  poc_escalation_handling: null,
  poc_availability: null,
  poc_proactive_approach: null,
  poc_timely_response: null,
  poc_requirement_understanding: null,
  referral_intent: "",
  leadership_meeting: "",
  services_meet_needs: null,
  improve_suggestions: "",
  other_comments: "",
});

export function isNpsFormComplete(form: NpsFormState): boolean {
  const ratings = [
    form.satisfaction_services,
    form.satisfaction_project_execution,
    form.gig_workforce_quality,
    form.poc_overall_communication,
    form.poc_escalation_handling,
    form.poc_availability,
    form.poc_proactive_approach,
    form.poc_timely_response,
    form.poc_requirement_understanding,
    form.services_meet_needs,
  ];
  if (ratings.some((r) => r === null)) return false;
  if (!form.referral_intent || !form.leadership_meeting) return false;
  if (!form.email.trim()) return false;
  if (!form.improve_suggestions.trim() || !form.other_comments.trim()) return false;
  return true;
}
