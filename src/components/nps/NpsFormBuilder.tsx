import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Save, Trash2, ChevronUp, ChevronDown, Settings2 } from "lucide-react";
import {
  NPS_INPUT_TYPE_LABELS,
  NPS_INPUT_TYPES,
  optionsToText,
  parseOptionsFromText,
  parseQuestionOptions,
  slugifyFieldKey,
  type NpsInputType,
  type NpsSurveyQuestion,
  type NpsSurveySettings,
} from "@/lib/nps-form";

type DraftQuestion = NpsSurveyQuestion & { isNew?: boolean };

function mapQuestionRow(row: Record<string, unknown>): NpsSurveyQuestion {
  return {
    id: String(row.id),
    field_key: String(row.field_key),
    section_title: String(row.section_title ?? ""),
    label: String(row.label),
    input_type: row.input_type as NpsInputType,
    required: Boolean(row.required),
    sort_order: Number(row.sort_order),
    options: parseQuestionOptions(row.options),
    is_system: Boolean(row.is_system),
  };
}

type NpsFormBuilderProps = {
  onSaved?: () => void;
};

export function NpsFormBuilder({ onSaved }: NpsFormBuilderProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Pick<NpsSurveySettings, "title" | "description">>({
    title: "Awign Feedback Survey",
    description: "",
  });
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<DraftQuestion | null>(null);

  const loadForm = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, questionsRes] = await Promise.all([
        supabase.from("nps_survey_settings").select("title, description").eq("id", 1).single(),
        supabase
          .from("nps_survey_questions")
          .select("*")
          .order("sort_order", { ascending: true }),
      ]);

      if (settingsRes.error) throw settingsRes.error;
      if (questionsRes.error) throw questionsRes.error;

      setSettings({
        title: settingsRes.data.title,
        description: settingsRes.data.description,
      });
      setQuestions((questionsRes.data ?? []).map((row) => mapQuestionRow(row as Record<string, unknown>)));
    } catch (error) {
      console.error("Error loading NPS form:", error);
      toast({
        title: "Could not load survey form",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadForm();
  }, [loadForm]);

  const reorder = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((q, i) => ({ ...q, sort_order: (i + 1) * 10 }));
    });
  };

  const addQuestion = () => {
    const label = "New question";
    const fieldKey = `${slugifyFieldKey(label)}_${Date.now().toString(36).slice(-4)}`;
    setQuestions((prev) => [
      ...prev,
      {
        id: `new-${crypto.randomUUID()}`,
        field_key: fieldKey,
        section_title: "Additional questions",
        label,
        input_type: "short_text",
        required: true,
        sort_order: (prev.length + 1) * 10,
        options: [],
        is_system: false,
        isNew: true,
      },
    ]);
  };

  const updateQuestion = (id: string, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q)),
    );
  };

  const confirmDelete = (question: DraftQuestion) => {
    if (question.is_system) {
      toast({
        title: "Cannot delete",
        description: "The email field is required for every survey.",
        variant: "destructive",
      });
      return;
    }
    setDeleteTarget(question);
  };

  const removeQuestion = (question: DraftQuestion) => {
    setQuestions((prev) => prev.filter((q) => q.id !== question.id));
    setDeleteTarget(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const keys = new Set<string>();
      for (const q of questions) {
        if (!q.label.trim()) {
          throw new Error("Every question needs a label.");
        }
        if (!q.field_key.trim()) {
          throw new Error("Every question needs a field key.");
        }
        if (keys.has(q.field_key)) {
          throw new Error(`Duplicate field key: ${q.field_key}`);
        }
        keys.add(q.field_key);
        if (q.input_type === "single_choice" && q.options.length === 0) {
          throw new Error(`"${q.label}" needs at least one choice option.`);
        }
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { error: settingsError } = await supabase
        .from("nps_survey_settings")
        .update({
          title: settings.title.trim(),
          description: settings.description.trim(),
          updated_at: new Date().toISOString(),
          updated_by: user?.id ?? null,
        })
        .eq("id", 1);

      if (settingsError) throw settingsError;

      const { data: existingRows, error: existingError } = await supabase
        .from("nps_survey_questions")
        .select("id, is_system");

      if (existingError) throw existingError;

      const persistedIds = new Set(
        questions.filter((q) => !q.isNew && !q.id.startsWith("new-")).map((q) => q.id),
      );

      const toDelete = (existingRows ?? []).filter(
        (row) => !persistedIds.has(row.id) && !row.is_system,
      );

      for (const row of toDelete) {
        const { error } = await supabase.from("nps_survey_questions").delete().eq("id", row.id);
        if (error) throw error;
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const payload = {
          field_key: q.field_key.trim(),
          section_title: q.section_title.trim(),
          label: q.label.trim(),
          input_type: q.input_type,
          required: q.required,
          sort_order: (i + 1) * 10,
          options: q.input_type === "single_choice" ? q.options : [],
          updated_at: new Date().toISOString(),
        };

        if (q.isNew || q.id.startsWith("new-")) {
          const { error } = await supabase.from("nps_survey_questions").insert({
            ...payload,
            is_system: false,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("nps_survey_questions")
            .update(payload)
            .eq("id", q.id);
          if (error) throw error;
        }
      }

      toast({
        title: "Survey form saved",
        description: "New surveys will use this configuration. Existing responses are unchanged.",
      });
      await loadForm();
      onSaved?.();
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Survey form configuration
          </CardTitle>
          <CardDescription>
            Add, edit, or remove questions and choose input types. Changes apply to new survey submissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="survey-title">Form title</Label>
              <Input
                id="survey-title"
                value={settings.title}
                onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="survey-description">Instructions (shown on public form)</Label>
              <Textarea
                id="survey-description"
                value={settings.description}
                onChange={(e) => setSettings((s) => ({ ...s, description: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <div className="space-y-4">
            {questions.map((question, index) => (
              <div
                key={question.id}
                className="rounded-lg border p-4 space-y-4 bg-muted/20"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Question {index + 1}
                    {question.is_system ? " (system)" : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      onClick={() => reorder(index, -1)}
                      aria-label="Move up"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === questions.length - 1}
                      onClick={() => reorder(index, 1)}
                      aria-label="Move down"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    {!question.is_system ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => confirmDelete(question)}
                        aria-label="Delete question"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Question label</Label>
                    <Input
                      value={question.label}
                      onChange={(e) => updateQuestion(question.id, { label: e.target.value })}
                      disabled={question.input_type === "email"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Section</Label>
                    <Input
                      value={question.section_title}
                      onChange={(e) =>
                        updateQuestion(question.id, { section_title: e.target.value })
                      }
                      placeholder="e.g. Service satisfaction"
                      disabled={question.is_system}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Input type</Label>
                    <Select
                      value={question.input_type}
                      onValueChange={(v) => {
                        const input_type = v as NpsInputType;
                        updateQuestion(question.id, {
                          input_type,
                          options: input_type === "single_choice" ? question.options : [],
                        });
                      }}
                      disabled={question.is_system}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NPS_INPUT_TYPES.filter((t) =>
                          question.is_system ? t === "email" : t !== "email",
                        ).map((type) => (
                          <SelectItem key={type} value={type}>
                            {NPS_INPUT_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {question.isNew ? (
                    <div className="space-y-2 md:col-span-2">
                      <Label>Field key (stored in database)</Label>
                      <Input
                        value={question.field_key}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            field_key: e.target.value.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
                          })
                        }
                      />
                    </div>
                  ) : (
                    <div className="space-y-2 md:col-span-2">
                      <Label className="text-muted-foreground">Field key</Label>
                      <p className="text-sm font-mono">{question.field_key}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`required-${question.id}`}
                      checked={question.required}
                      onCheckedChange={(checked) =>
                        updateQuestion(question.id, { required: checked })
                      }
                      disabled={question.is_system}
                    />
                    <Label htmlFor={`required-${question.id}`}>Required</Label>
                  </div>
                </div>

                {question.input_type === "single_choice" ? (
                  <div className="space-y-2">
                    <Label>Options (one per line)</Label>
                    <Textarea
                      value={optionsToText(question.options)}
                      onChange={(e) =>
                        updateQuestion(question.id, {
                          options: parseOptionsFromText(e.target.value),
                        })
                      }
                      rows={4}
                      placeholder={"Yes\nNo\nMaybe"}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button type="button" variant="outline" onClick={addQuestion}>
              <Plus className="mr-2 h-4 w-4" />
              Add question
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save form
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTarget?.label}&quot; will be removed from the survey. Past responses keep
              their saved answers for this field.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && removeQuestion(deleteTarget)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
