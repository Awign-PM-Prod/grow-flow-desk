import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NpsResponseReadOnlyField } from "@/components/nps/NpsResponseReadOnlyField";
import {
  groupQuestionsBySection,
  normalizeAnswersFromDb,
  type NpsAnswers,
  type NpsSurveyQuestion,
} from "@/lib/nps-form";

type NpsResponseDetailViewProps = {
  questions: NpsSurveyQuestion[];
  answers: NpsAnswers | Record<string, unknown>;
  contactName?: string | null;
  accountName?: string | null;
  department?: string | null;
};

export function NpsResponseDetailView({
  questions,
  answers: answersRaw,
  contactName,
  accountName,
  department,
}: NpsResponseDetailViewProps) {
  const answers = normalizeAnswersFromDb(answersRaw);
  const sections = groupQuestionsBySection(questions);

  const contactSection = sections.get("Contact Details");
  const otherSections = [...sections.entries()].filter(([title]) => title !== "Contact Details");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {contactSection?.map((question) => (
            <NpsResponseReadOnlyField key={question.id} question={question} answers={answers} />
          ))}
          <div className="grid gap-4 sm:grid-cols-1">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Contact Name</p>
              <p className="text-sm rounded-md border bg-muted/30 px-3 py-3">{contactName ?? "—"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Account</p>
              <p className="text-sm rounded-md border bg-muted/30 px-3 py-3">{accountName ?? "—"}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Department</p>
              <p className="text-sm rounded-md border bg-muted/30 px-3 py-3">{department ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {otherSections.map(([sectionTitle, sectionQuestions]) => (
        <Card key={sectionTitle}>
          <CardHeader>
            <CardTitle className="text-lg">{sectionTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {sectionQuestions
              .filter((q) => q.input_type !== "email")
              .map((question) => (
                <NpsResponseReadOnlyField key={question.id} question={question} answers={answers} />
              ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
