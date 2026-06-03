import { Label } from "@/components/ui/label";
import { NpsRatingDisplay } from "@/components/nps/NpsRatingDisplay";
import { cn } from "@/lib/utils";
import {
  formatAnswerForDisplay,
  type NpsAnswers,
  type NpsSurveyQuestion,
} from "@/lib/nps-form";

function ReadOnlyChoice({
  options,
  selected,
}: {
  options: string[];
  selected: string;
}) {
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const isSelected = option === selected;
        return (
          <div
            key={option}
            className={cn(
              "flex items-center gap-3 rounded-md border px-3 py-2.5",
              isSelected ? "border-primary bg-primary/5" : "border-border bg-muted/20",
            )}
          >
            <div
              className={cn(
                "h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center",
                isSelected ? "border-primary" : "border-muted-foreground/40",
              )}
            >
              {isSelected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
            </div>
            <span className={cn("text-sm", isSelected ? "font-medium text-foreground" : "text-muted-foreground")}>
              {option}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ReadOnlyTextAnswer({ value }: { value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-3 text-sm whitespace-pre-wrap leading-relaxed">
      {value || "—"}
    </div>
  );
}

type NpsResponseReadOnlyFieldProps = {
  question: NpsSurveyQuestion;
  answers: NpsAnswers;
};

export function NpsResponseReadOnlyField({ question, answers }: NpsResponseReadOnlyFieldProps) {
  const raw = answers[question.field_key];

  if (question.input_type === "rating") {
    const num = typeof raw === "number" ? raw : Number(String(raw ?? ""));
    if (!Number.isFinite(num)) {
      return (
        <div className="space-y-2">
          <Label className="text-base font-medium leading-snug">{question.label}</Label>
          <ReadOnlyTextAnswer value="—" />
        </div>
      );
    }
    return <NpsRatingDisplay label={question.label} value={num} />;
  }

  if (question.input_type === "single_choice") {
    return (
      <div className="space-y-3">
        <Label className="text-base font-medium leading-snug">{question.label}</Label>
        <ReadOnlyChoice options={question.options} selected={String(raw ?? "")} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-base font-medium leading-snug">{question.label}</Label>
      <ReadOnlyTextAnswer value={formatAnswerForDisplay(question, raw as string | number)} />
    </div>
  );
}
