import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NpsRatingDisplay } from "@/components/nps/NpsRatingDisplay";
import {
  NPS_LEADERSHIP_OPTIONS,
  NPS_REFERRAL_OPTIONS,
  NPS_SERVICE_SATISFACTION_FIELDS,
  POC_SATISFACTION_FIELDS,
  npsRecordToFormState,
  type NpsResponseRecord,
} from "@/lib/nps";
import { cn } from "@/lib/utils";

type NpsResponseDetailViewProps = {
  response: NpsResponseRecord;
  contactName?: string | null;
  accountName?: string | null;
  department?: string | null;
};

function ReadOnlyChoice({
  options,
  selected,
}: {
  options: readonly string[];
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

function ContactDetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{label}</Label>
      <ReadOnlyTextAnswer value={value} />
    </div>
  );
}

export function NpsResponseDetailView({
  response,
  contactName,
  accountName,
  department,
}: NpsResponseDetailViewProps) {
  const form = npsRecordToFormState(response);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contact Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ContactDetailField label="Email ID" value={form.email} />
          <ContactDetailField label="Contact Name" value={contactName ?? "—"} />
          <ContactDetailField label="Account" value={accountName ?? "—"} />
          <ContactDetailField label="Department" value={department ?? "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Service satisfaction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {NPS_SERVICE_SATISFACTION_FIELDS.map((field) => (
            <NpsRatingDisplay
              key={field.key}
              label={field.label}
              value={form[field.key] as number}
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
            <NpsRatingDisplay
              key={field.key}
              label={field.label}
              value={form[field.key] as number}
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
            <Label className="text-base font-medium leading-snug">
              Would you refer Awign to other peer groups within or outside your organization?
            </Label>
            <ReadOnlyChoice options={NPS_REFERRAL_OPTIONS} selected={form.referral_intent} />
          </div>

          <div className="space-y-3">
            <Label className="text-base font-medium leading-snug">Have you met Awign&apos;s Leadership?</Label>
            <ReadOnlyChoice options={NPS_LEADERSHIP_OPTIONS} selected={form.leadership_meeting} />
          </div>

          <NpsRatingDisplay
            label="How well do our services meet your needs?"
            value={form.services_meet_needs as number}
          />

          <div className="space-y-2">
            <Label className="text-base font-medium leading-snug">What can Awign do better?</Label>
            <ReadOnlyTextAnswer value={form.improve_suggestions} />
          </div>

          <div className="space-y-2">
            <Label className="text-base font-medium leading-snug">
              Do you have any other comments, questions or concerns?
            </Label>
            <ReadOnlyTextAnswer value={form.other_comments} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
