export const NPS_INPUT_TYPES = [
  "email",
  "rating",
  "short_text",
  "long_text",
  "single_choice",
] as const;

export type NpsInputType = (typeof NPS_INPUT_TYPES)[number];

export const NPS_INPUT_TYPE_LABELS: Record<NpsInputType, string> = {
  email: "Email (read-only for respondent)",
  rating: "Rating scale (1–5)",
  short_text: "Short text",
  long_text: "Long text",
  single_choice: "Single choice",
};

export type NpsSurveySettings = {
  id: number;
  title: string;
  description: string;
  updated_at: string;
};

export type NpsSurveyQuestion = {
  id: string;
  field_key: string;
  section_title: string;
  label: string;
  input_type: NpsInputType;
  required: boolean;
  sort_order: number;
  options: string[];
  is_system: boolean;
};

export type NpsSurveyFormConfig = {
  settings: NpsSurveySettings;
  questions: NpsSurveyQuestion[];
};

export type NpsAnswers = Record<string, string | number>;

export function slugifyFieldKey(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return base || `question_${Date.now()}`;
}

export function parseQuestionOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((o) => String(o).trim()).filter(Boolean);
  }
  return [];
}

export function parseOptionsFromText(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function optionsToText(options: string[]): string {
  return options.join("\n");
}

export function groupQuestionsBySection(questions: NpsSurveyQuestion[]): Map<string, NpsSurveyQuestion[]> {
  const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order);
  const map = new Map<string, NpsSurveyQuestion[]>();
  for (const q of sorted) {
    const section = q.section_title.trim() || "Questions";
    const list = map.get(section) ?? [];
    list.push(q);
    map.set(section, list);
  }
  return map;
}

export function emptyAnswersForQuestions(
  questions: NpsSurveyQuestion[],
  email = "",
): NpsAnswers {
  const answers: NpsAnswers = {};
  for (const q of questions) {
    if (q.input_type === "email") {
      answers[q.field_key] = email;
    } else if (q.input_type === "rating") {
      answers[q.field_key] = "";
    } else {
      answers[q.field_key] = "";
    }
  }
  return answers;
}

export function normalizeAnswersFromDb(answers: unknown): NpsAnswers {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) {
    return {};
  }
  const out: NpsAnswers = {};
  for (const [key, value] of Object.entries(answers as Record<string, unknown>)) {
    if (typeof value === "number") {
      out[key] = value;
    } else if (typeof value === "string") {
      out[key] = value;
    } else if (value != null) {
      out[key] = String(value);
    }
  }
  return out;
}

export function formatAnswerForDisplay(
  question: NpsSurveyQuestion,
  value: string | number | undefined,
): string {
  if (value === undefined || value === null || value === "") {
    return "—";
  }
  if (question.input_type === "rating" && typeof value === "number") {
    return `${value} / 5`;
  }
  return String(value);
}

export function validateNpsAnswers(
  questions: NpsSurveyQuestion[],
  answers: NpsAnswers,
): string | null {
  const sorted = [...questions].sort((a, b) => a.sort_order - b.sort_order);

  for (const q of sorted) {
    const raw = answers[q.field_key];
    const str = raw === undefined || raw === null ? "" : String(raw).trim();

    if (q.required) {
      if (q.input_type === "rating") {
        const num = typeof raw === "number" ? raw : Number(str);
        if (!Number.isInteger(num) || num < 1 || num > 5) {
          return `"${q.label}" requires a rating from 1 to 5.`;
        }
        continue;
      }
      if (!str) {
        return `"${q.label}" is required.`;
      }
    } else if (str === "" && q.input_type !== "rating") {
      continue;
    }

    if (q.input_type === "rating" && str !== "") {
      const num = typeof raw === "number" ? raw : Number(str);
      if (!Number.isInteger(num) || num < 1 || num > 5) {
        return `"${q.label}" must be a rating from 1 to 5.`;
      }
    }

    if (q.input_type === "single_choice" && str) {
      const opts = q.options;
      if (opts.length > 0 && !opts.includes(str)) {
        return `"${q.label}" has an invalid selection.`;
      }
    }
  }

  return null;
}

export function isNpsAnswersComplete(questions: NpsSurveyQuestion[], answers: NpsAnswers): boolean {
  return validateNpsAnswers(questions, answers) === null;
}

export function serializeAnswersForSubmit(questions: NpsSurveyQuestion[], answers: NpsAnswers): NpsAnswers {
  const out: NpsAnswers = {};
  for (const q of questions) {
    const raw = answers[q.field_key];
    if (q.input_type === "rating") {
      const num = typeof raw === "number" ? raw : Number(String(raw ?? "").trim());
      out[q.field_key] = num;
    } else {
      out[q.field_key] = String(raw ?? "").trim();
    }
  }
  return out;
}

export type NpsResponseRecord = {
  id: string;
  invite_id: string;
  contact_id: string;
  email: string;
  submitted_at: string;
  answers: NpsAnswers;
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

export function buildNpsCsvHeaders(questions: NpsSurveyQuestion[]): { key: string; label: string }[] {
  const base = [
    { key: "submitted_at", label: "Submitted At" },
    { key: "email", label: "Email" },
    { key: "contact_name", label: "Contact Name" },
    { key: "account_name", label: "Account" },
    { key: "department", label: "Department" },
  ];
  const sorted = [...questions]
    .filter((q) => q.input_type !== "email")
    .sort((a, b) => a.sort_order - b.sort_order);
  for (const q of sorted) {
    base.push({ key: `answer_${q.field_key}`, label: q.label });
  }
  return base;
}

export function npsResponsesToCsvRows(
  responses: NpsResponseListRow[],
  questions: NpsSurveyQuestion[],
): Record<string, string | number>[] {
  const sorted = [...questions]
    .filter((q) => q.input_type !== "email")
    .sort((a, b) => a.sort_order - b.sort_order);

  return responses.map((row) => {
    const answers = normalizeAnswersFromDb(row.answers);
    const record: Record<string, string | number> = {
      submitted_at: formatNpsSubmittedAtForCsv(row.submitted_at),
      email: row.email,
      contact_name: row.contact_name ?? "",
      account_name: row.account_name ?? "",
      department: row.department ?? "",
    };
    for (const q of sorted) {
      const val = answers[q.field_key];
      record[`answer_${q.field_key}`] =
        val === undefined || val === null ? "" : formatAnswerForDisplay(q, val);
    }
    return record;
  });
}
