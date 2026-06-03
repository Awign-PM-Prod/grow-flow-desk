import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle2 } from "lucide-react";
import { RatingScale } from "@/components/nps/RatingScale";
import {
  emptyNpsFormState,
  isNpsFormComplete,
  NPS_LEADERSHIP_OPTIONS,
  NPS_REFERRAL_OPTIONS,
  NPS_SERVICE_SATISFACTION_FIELDS,
  POC_SATISFACTION_FIELDS,
  type NpsFormState,
} from "@/lib/nps";

export default function NpsSurvey() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<NpsFormState>(emptyNpsFormState());

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

        if (fnError) {
          throw fnError;
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        if (data?.already_submitted) {
          setAlreadySubmitted(true);
          return;
        }

        setForm(emptyNpsFormState(data.email || ""));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to load survey";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void loadSurvey();
  }, [token]);

  const updateForm = <K extends keyof NpsFormState>(key: K, value: NpsFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!isNpsFormComplete(form)) {
      setError("Please answer all required questions.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("submit-nps-survey", {
        body: {
          token,
          email: form.email.trim(),
          satisfaction_services: form.satisfaction_services,
          satisfaction_project_execution: form.satisfaction_project_execution,
          gig_workforce_quality: form.gig_workforce_quality,
          poc_overall_communication: form.poc_overall_communication,
          poc_escalation_handling: form.poc_escalation_handling,
          poc_availability: form.poc_availability,
          poc_proactive_approach: form.poc_proactive_approach,
          poc_timely_response: form.poc_timely_response,
          poc_requirement_understanding: form.poc_requirement_understanding,
          referral_intent: form.referral_intent,
          leadership_meeting: form.leadership_meeting,
          services_meet_needs: form.services_meet_needs,
          improve_suggestions: form.improve_suggestions.trim(),
          other_comments: form.other_comments.trim(),
        },
      });

      if (fnError) {
        throw fnError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

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

  if (error && !form.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center text-destructive">{error}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Awign Feedback Survey</h1>
          <p className="text-muted-foreground">
            All questions are required. Please rate each item from 1 (Very Unsatisfied) to 5 (Very Satisfied).
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  readOnly
                  className="bg-muted"
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Service satisfaction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {NPS_SERVICE_SATISFACTION_FIELDS.map((field) => (
                <RatingScale
                  key={field.key}
                  label={field.label}
                  value={form[field.key]}
                  onChange={(v) => updateForm(field.key, v)}
                  required
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How satisfied were your POC?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              {POC_SATISFACTION_FIELDS.map((field) => (
                <RatingScale
                  key={field.key}
                  label={field.label}
                  value={form[field.key]}
                  onChange={(v) => updateForm(field.key, v)}
                  required
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Additional questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Would you refer Awign to other peer groups within or outside your organization?{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={form.referral_intent}
                  onValueChange={(v) => updateForm("referral_intent", v as NpsFormState["referral_intent"])}
                  className="flex flex-wrap gap-4"
                >
                  {NPS_REFERRAL_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`referral-${option}`} />
                      <Label htmlFor={`referral-${option}`} className="font-normal cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">
                  Have you met Awign&apos;s Leadership? <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={form.leadership_meeting}
                  onValueChange={(v) => updateForm("leadership_meeting", v as NpsFormState["leadership_meeting"])}
                  className="space-y-2"
                >
                  {NPS_LEADERSHIP_OPTIONS.map((option) => (
                    <div key={option} className="flex items-center space-x-2">
                      <RadioGroupItem value={option} id={`leadership-${option}`} />
                      <Label htmlFor={`leadership-${option}`} className="font-normal cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <RatingScale
                label="How well do our services meet your needs?"
                value={form.services_meet_needs}
                onChange={(v) => updateForm("services_meet_needs", v)}
                required
              />

              <div className="space-y-2">
                <Label htmlFor="improve">
                  What can Awign do better? <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="improve"
                  value={form.improve_suggestions}
                  onChange={(e) => updateForm("improve_suggestions", e.target.value)}
                  placeholder="Your suggestions..."
                  required
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="comments">
                  Do you have any other comments, questions or concerns?{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="comments"
                  value={form.other_comments}
                  onChange={(e) => updateForm("other_comments", e.target.value)}
                  placeholder="Your comments..."
                  required
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          <div className="flex justify-center pb-8">
            <Button type="submit" size="lg" disabled={submitting || !isNpsFormComplete(form)}>
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
