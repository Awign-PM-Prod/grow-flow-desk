import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useState } from "react";

const stages = ["Prospecting", "Qualification", "Proposal", "Negotiation", "Closed Won"];

const dummyDeals = [
  { id: 1, title: "Software License - Acme", value: "$45K", stage: "Prospecting", probability: 20 },
  { id: 2, title: "Consulting Services - Global", value: "$80K", stage: "Qualification", probability: 40 },
  { id: 3, title: "Training Package - Tech Sol", value: "$25K", stage: "Proposal", probability: 60 },
  { id: 4, title: "Support Contract - Finance", value: "$120K", stage: "Negotiation", probability: 80 },
  { id: 5, title: "Implementation - Retail", value: "$200K", stage: "Closed Won", probability: 100 },
  { id: 6, title: "Cloud Services - StartupXYZ", value: "$35K", stage: "Prospecting", probability: 15 },
  { id: 7, title: "Security Suite - MegaCorp", value: "$150K", stage: "Qualification", probability: 35 },
  { id: 8, title: "Data Migration - FinTech", value: "$95K", stage: "Proposal", probability: 65 },
];

export default function Pipeline() {
  const [deals] = useState(dummyDeals);

  const getDealsByStage = (stage: string) => {
    return deals.filter((deal) => deal.stage === stage);
  };

  const getStageTotal = (stage: string) => {
    return getDealsByStage(stage).reduce((sum, deal) => {
      const value = parseInt(deal.value.replace(/[$K]/g, ""));
      return sum + value;
    }, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cross-sell Pipeline</h1>
          <p className="text-muted-foreground">
            Manage your sales opportunities and track deal progress.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Deal
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {stages.map((stage) => (
          <div key={stage} className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">
                  {stage}
                  <div className="mt-1 text-xs font-normal text-muted-foreground">
                    ${getStageTotal(stage)}K total
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>

            <div className="space-y-3">
              {getDealsByStage(stage).map((deal) => (
                <Card key={deal.id} className="cursor-pointer transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm leading-tight">{deal.title}</h4>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-primary">{deal.value}</span>
                        <Badge variant="outline" className="text-xs">
                          {deal.probability}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
