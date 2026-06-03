import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { NpsDynamicForm } from "@/components/nps/NpsDynamicForm";
import {
  emptyAnswersForQuestions,
  isNpsAnswersComplete,
  parseQuestionOptions,
  serializeAnswersForSubmit,
  validateNpsAnswers,
  type NpsAnswers,
  type NpsSurveyFormConfig,
  type NpsSurveyQuestion,
} from "@/lib/nps-form";

function parseFormFromApi(data: Record<string, unknown>): {
  email: string;
  form: NpsSurveyFormConfig;
} {
  const settings = data.settings as Record<string, unknown>;
  const questions = (data.questions as Record<string, unknown>[]).map((row): NpsSurveyQuestion => ({
    id: String(row.id),
    field_key: String(row.field_key),
    section_title: String(row.section_title ?? ""),
    label: String(row.label),
    input_type: row.input_type as NpsSurveyQuestion["input_type"],
    required: Boolean(row.required),
    sort_order: Number(row.sort_order),
    options: parseQuestionOptions(row.options),
    is_system: Boolean(row.is_system),
  }));

  return {
    email: String(data.email ?? ""),
    form: {
      settings: {
        id: 1,
        title: String(settings?.title ?? "Awign Feedback Survey"),
        description: String(settings?.description ?? ""),
        updated_at: "",
      },
      questions,
    },
  };
}

export default function NpsSurvey() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formConfig, setFormConfig] = useState<NpsSurveyFormConfig | null>(null);
  const [answers, setAnswers] = useState<NpsAnswers>({});

  useEffect(() => {
    if (!token) {
      setError("Invalid survey link");
      setLoading(false);
      return;
    }

    const loadSurvey = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("get-nps-survey", {
          body: { token },
        });

        if (fnError) throw fnError;
        if (data?.error) throw new Error(data.error);

        if (data?.already_submitted) {
          setAlreadySubmitted(true);
          return;
        }

        const { email, form } = parseFormFromApi(data as Record<string, unknown>);
        setFormConfig(form);
        setAnswers(emptyAnswersForQuestions(form.questions, email));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to load survey";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadSurvey();
  }, [token]);

  const handleAnswerChange = (fieldKey: string, value: string | number) => {
    setAnswers((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !formConfig) return;

    const validationError = validateNpsAnswers(formConfig.questions, answers);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = serializeAnswersForSubmit(formConfig.questions, answers);
      const { data, error: fnError } = await supabase.functions.invoke("submit-nps-survey", {
        body: {
          token,
          answers: payload,
        },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to submit survey";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (alreadySubmitted || submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h1 className="text-xl font-semibold">Thank you!</h1>
            <p className="text-muted-foreground">
              {alreadySubmitted
                ? "You have already submitted this survey."
                : "Your feedback has been submitted successfully. We appreciate your time."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !formConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (!formConfig) {
    return null;
  }

  const complete = isNpsAnswersComplete(formConfig.questions, answers);

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{formConfig.settings.title}</h1>
          {formConfig.settings.description ? (
            <p className="text-muted-foreground">{formConfig.settings.description}</p>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <NpsDynamicForm
            questions={formConfig.questions}
            answers={answers}
            onAnswerChange={handleAnswerChange}
          />

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <div className="flex justify-center pb-8">
            <Button type="submit" size="lg" disabled={submitting || !complete}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
