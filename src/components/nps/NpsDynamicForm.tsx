import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RatingScale } from "@/components/nps/RatingScale";
import {
  groupQuestionsBySection,
  type NpsAnswers,
  type NpsSurveyQuestion,
} from "@/lib/nps-form";

type NpsDynamicFormProps = {
  questions: NpsSurveyQuestion[];
  answers: NpsAnswers;
  onAnswerChange: (fieldKey: string, value: string | number) => void;
  readOnly?: boolean;
};

export function NpsDynamicForm({
  questions,
  answers,
  onAnswerChange,
  readOnly = false,
}: NpsDynamicFormProps) {
  const sections = groupQuestionsBySection(questions);

  return (
    <div className="space-y-6">
      {[...sections.entries()].map(([sectionTitle, sectionQuestions]) => (
        <Card key={sectionTitle}>
          <CardHeader>
            <CardTitle className="text-lg">{sectionTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {sectionQuestions.map((question) => {
              const value = answers[question.field_key];
              const required = question.required;

              if (question.input_type === "email") {
                return (
                  <div key={question.id} className="space-y-2">
                    <Label htmlFor={question.field_key}>
                      {question.label}
                      {required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Input
                      id={question.field_key}
                      type="email"
                      value={String(value ?? "")}
                      readOnly
                      className="bg-muted"
                      required={required}
                    />
                  </div>
                );
              }

              if (question.input_type === "rating") {
                const ratingValue =
                  typeof value === "number"
                    ? value
                    : value === "" || value === undefined
                      ? null
                      : Number(value);
                return (
                  <RatingScale
                    key={question.id}
                    label={question.label}
                    value={Number.isFinite(ratingValue as number) ? (ratingValue as number) : null}
                    onChange={(v) => onAnswerChange(question.field_key, v)}
                    required={required}
                  />
                );
              }

              if (question.input_type === "single_choice") {
                return (
                  <div key={question.id} className="space-y-3">
                    <Label className="text-base font-medium leading-snug">
                      {question.label}
                      {required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <RadioGroup
                      value={String(value ?? "")}
                      onValueChange={(v) => onAnswerChange(question.field_key, v)}
                      className="space-y-2"
                      disabled={readOnly}
                    >
                      {question.options.map((option) => (
                        <div key={option} className="flex items-center space-x-2">
                          <RadioGroupItem
                            value={option}
                            id={`${question.field_key}-${option}`}
                          />
                          <Label
                            htmlFor={`${question.field_key}-${option}`}
                            className="font-normal cursor-pointer"
                          >
                            {option}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                );
              }

              if (question.input_type === "long_text") {
                return (
                  <div key={question.id} className="space-y-2">
                    <Label htmlFor={question.field_key}>
                      {question.label}
                      {required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Textarea
                      id={question.field_key}
                      value={String(value ?? "")}
                      onChange={(e) => onAnswerChange(question.field_key, e.target.value)}
                      placeholder="Your response..."
                      required={required}
                      rows={4}
                      readOnly={readOnly}
                    />
                  </div>
                );
              }

              return (
                <div key={question.id} className="space-y-2">
                  <Label htmlFor={question.field_key}>
                    {question.label}
                    {required && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Input
                    id={question.field_key}
                    value={String(value ?? "")}
                    onChange={(e) => onAnswerChange(question.field_key, e.target.value)}
                    required={required}
                    readOnly={readOnly}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
