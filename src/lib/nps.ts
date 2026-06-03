export const NPS_REFERRAL_OPTIONS = ["Yes", "No", "Maybe"] as const;
export type NpsReferralIntent = (typeof NPS_REFERRAL_OPTIONS)[number];

export const NPS_LEADERSHIP_OPTIONS = [
  "Yes, We have Met Virtually",
  "Yes, We have met personally",
  "No",
] as const;
export type NpsLeadershipMeeting = (typeof NPS_LEADERSHIP_OPTIONS)[number];

export const NPS_SERVICE_SATISFACTION_FIELDS = [
  { key: "satisfaction_services", label: "How satisfied are you with Awign's services?" },
  { key: "satisfaction_project_execution", label: "How satisfied are you on Project Execution?" },
  { key: "gig_workforce_quality", label: "How do you rate Awign's Gig Workforce Quality?" },
] as const;

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

/** Stored NPS response row (matches `nps_responses` table). */
export type NpsResponseRecord = {
  id: string;
  invite_id: string;
  contact_id: string;
  email: string;
  submitted_at: string;
  satisfaction_services: number;
  satisfaction_project_execution: number;
  gig_workforce_quality: number;
  poc_overall_communication: number;
  poc_escalation_handling: number;
  poc_availability: number;
  poc_proactive_approach: number;
  poc_timely_response: number;
  poc_requirement_understanding: number;
  referral_intent: NpsReferralIntent;
  leadership_meeting: NpsLeadershipMeeting;
  services_meet_needs: number;
  improve_suggestions: string;
  other_comments: string;
};

export type NpsResponseListRow = NpsResponseRecord & {
  contact_name: string | null;
  account_id: string | null;
  account_name: string | null;
  department: string | null;
};

export type NpsResponseFilters = {
  accountId: string;
  contactId: string;
  submittedDates: Date[];
};

export const NPS_RESPONSE_CSV_HEADERS: { key: string; label: string }[] = [
  { key: "submitted_at", label: "Submitted At" },
  { key: "email", label: "Email" },
  { key: "contact_name", label: "Contact Name" },
  { key: "account_name", label: "Account" },
  { key: "department", label: "Department" },
  { key: "satisfaction_services", label: "Satisfaction - Services" },
  { key: "satisfaction_project_execution", label: "Satisfaction - Project Execution" },
  { key: "gig_workforce_quality", label: "Gig Workforce Quality" },
  { key: "poc_overall_communication", label: "POC - Overall Communication" },
  { key: "poc_escalation_handling", label: "POC - Escalation Handling" },
  { key: "poc_availability", label: "POC - Availability" },
  { key: "poc_proactive_approach", label: "POC - Proactive Approach" },
  { key: "poc_timely_response", label: "POC - Timely Response" },
  { key: "poc_requirement_understanding", label: "POC - Requirement Understanding" },
  { key: "referral_intent", label: "Referral Intent" },
  { key: "leadership_meeting", label: "Leadership Meeting" },
  { key: "services_meet_needs", label: "Services Meet Needs" },
  { key: "improve_suggestions", label: "What Can Awign Do Better" },
  { key: "other_comments", label: "Other Comments" },
];

function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** One date = that calendar day; two dates = inclusive range between them. */
export function matchesNpsSubmittedDateFilter(submittedAt: string, selectedDates: Date[]): boolean {
  if (selectedDates.length === 0) return true;

  const submitted = new Date(submittedAt).getTime();
  const sorted = [...selectedDates].sort((a, b) => a.getTime() - b.getTime());

  if (sorted.length === 1) {
    return (
      submitted >= startOfLocalDay(sorted[0]).getTime() &&
      submitted <= endOfLocalDay(sorted[0]).getTime()
    );
  }

  return (
    submitted >= startOfLocalDay(sorted[0]).getTime() &&
    submitted <= endOfLocalDay(sorted[1]).getTime()
  );
}

export function filterNpsResponses(
  responses: NpsResponseListRow[],
  filters: NpsResponseFilters,
): NpsResponseListRow[] {
  return responses.filter((row) => {
    if (filters.accountId !== "all" && row.account_id !== filters.accountId) {
      return false;
    }
    if (filters.contactId !== "all" && row.contact_id !== filters.contactId) {
      return false;
    }
    if (!matchesNpsSubmittedDateFilter(row.submitted_at, filters.submittedDates)) {
      return false;
    }
    return true;
  });
}

export function formatNpsSubmittedAtForCsv(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function npsResponsesToCsvRows(responses: NpsResponseListRow[]): Record<string, string | number>[] {
  return responses.map((row) => ({
    submitted_at: formatNpsSubmittedAtForCsv(row.submitted_at),
    email: row.email,
    contact_name: row.contact_name ?? "",
    account_name: row.account_name ?? "",
    department: row.department ?? "",
    satisfaction_services: row.satisfaction_services,
    satisfaction_project_execution: row.satisfaction_project_execution,
    gig_workforce_quality: row.gig_workforce_quality,
    poc_overall_communication: row.poc_overall_communication,
    poc_escalation_handling: row.poc_escalation_handling,
    poc_availability: row.poc_availability,
    poc_proactive_approach: row.poc_proactive_approach,
    poc_timely_response: row.poc_timely_response,
    poc_requirement_understanding: row.poc_requirement_understanding,
    referral_intent: row.referral_intent,
    leadership_meeting: row.leadership_meeting,
    services_meet_needs: row.services_meet_needs,
    improve_suggestions: row.improve_suggestions,
    other_comments: row.other_comments,
  }));
}

export function npsRecordToFormState(record: NpsResponseRecord): NpsFormState {
  return {
    email: record.email,
    satisfaction_services: record.satisfaction_services,
    satisfaction_project_execution: record.satisfaction_project_execution,
    gig_workforce_quality: record.gig_workforce_quality,
    poc_overall_communication: record.poc_overall_communication,
    poc_escalation_handling: record.poc_escalation_handling,
    poc_availability: record.poc_availability,
    poc_proactive_approach: record.poc_proactive_approach,
    poc_timely_response: record.poc_timely_response,
    poc_requirement_understanding: record.poc_requirement_understanding,
    referral_intent: record.referral_intent,
    leadership_meeting: record.leadership_meeting,
    services_meet_needs: record.services_meet_needs,
    improve_suggestions: record.improve_suggestions,
    other_comments: record.other_comments,
  };
}

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
