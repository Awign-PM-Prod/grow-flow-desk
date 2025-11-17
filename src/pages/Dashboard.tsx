import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, FileText, TrendingUp, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Status order mapping for chronological sorting
const statusOrder: Record<string, number> = {
  "Listed": 1,
  "Pre-Appointment Prep Done": 2,
  "Discovery Meeting Done": 3,
  "Requirement Gathering Done": 4,
  "Solution Proposal Made": 5,
  "SOW Handshake Done": 6,
  "Final Proposal Done": 7,
  "Commercial Agreed": 8,
  "Closed Won": 9,
  "Dropped": 10,
};

// Helper function to get short label for long status names
const getStatusLabel = (status: string): string => {
  const shortLabels: Record<string, string> = {
    "Pre-Appointment Prep Done": "Pre-Appt Prep",
    "Discovery Meeting Done": "Discovery Meeting",
    "Requirement Gathering Done": "Requirement Gathering",
    "Solution Proposal Made": "Solution Proposal",
    "SOW Handshake Done": "SOW Handshake",
    "Final Proposal Done": "Final Proposal",
    "Commercial Agreed": "Commercial Agreed",
  };
  return shortLabels[status] || status;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [totalContacts, setTotalContacts] = useState(0);
  const [totalMandates, setTotalMandates] = useState(0);
  const [pipelineValue, setPipelineValue] = useState(0);
  const [revenueData, setRevenueData] = useState<Array<{ month: string; revenue: number; target: number }>>([]);
  const [pipelineData, setPipelineData] = useState<Array<{ stage: string; stageLabel: string; count: number }>>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch accounts count
      const { count: accountsCount } = await supabase
        .from("accounts")
        .select("*", { count: "exact", head: true });

      // Fetch contacts count
      const { count: contactsCount } = await supabase
        .from("contacts")
        .select("*", { count: "exact", head: true });

      // Fetch mandates count
      const { count: mandatesCount } = await supabase
        .from("mandates")
        .select("*", { count: "exact", head: true });

      // Fetch pipeline deals
      const { data: deals } = await supabase
        .from("pipeline_deals")
        .select("expected_revenue, status");

      // Calculate pipeline value (sum of expected_revenue)
      const totalPipelineValue = deals?.reduce((sum, deal) => {
        const revenue = parseFloat(deal.expected_revenue) || 0;
        return sum + revenue;
      }, 0) || 0;

      // Group pipeline deals by status
      const statusCounts: Record<string, number> = {};
      deals?.forEach((deal) => {
        const status = deal.status || "Unknown";
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      // Sort by status order and create data array with both full and short labels
      const pipelineStatusData = Object.entries(statusCounts)
        .map(([stage, count]) => ({
          stage,
          stageLabel: getStatusLabel(stage),
          count,
          order: statusOrder[stage] || 999, // Unknown statuses go to the end
        }))
        .sort((a, b) => a.order - b.order);

      // Fetch mandates for revenue chart (using monthly_data)
      const { data: mandates } = await supabase
        .from("mandates")
        .select("monthly_data, revenue_mcv");

      // Process monthly revenue data
      const monthlyRevenue: Record<string, { revenue: number; target: number }> = {};
      
      mandates?.forEach((mandate) => {
        if (mandate.monthly_data && typeof mandate.monthly_data === 'object') {
          Object.entries(mandate.monthly_data).forEach(([monthYear, values]) => {
            const [year, month] = monthYear.split('-');
            const monthIndex = parseInt(month) - 1;
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthName = monthNames[monthIndex];
            
            if (Array.isArray(values) && values.length >= 2) {
              const achievedMcv = parseFloat(values[1]) || 0;
              const plannedMcv = parseFloat(values[0]) || 0;
              
              if (!monthlyRevenue[monthYear]) {
                monthlyRevenue[monthYear] = { revenue: 0, target: 0 };
              }
              monthlyRevenue[monthYear].revenue += achievedMcv;
              monthlyRevenue[monthYear].target += plannedMcv;
            }
          });
        }
      });

      // Convert to array and sort by date
      const revenueChartData = Object.entries(monthlyRevenue)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6) // Last 6 months
        .map(([monthYear, data]) => {
          const [year, month] = monthYear.split('-');
          const monthIndex = parseInt(month) - 1;
          const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          return {
            month: monthNames[monthIndex],
            revenue: Math.round(data.revenue),
            target: Math.round(data.target),
          };
        });

      setTotalAccounts(accountsCount || 0);
      setTotalContacts(contactsCount || 0);
      setTotalMandates(mandatesCount || 0);
      setPipelineValue(totalPipelineValue);
      setRevenueData(revenueChartData.length > 0 ? revenueChartData : [
        { month: "Jan", revenue: 0, target: 0 },
        { month: "Feb", revenue: 0, target: 0 },
        { month: "Mar", revenue: 0, target: 0 },
        { month: "Apr", revenue: 0, target: 0 },
        { month: "May", revenue: 0, target: 0 },
        { month: "Jun", revenue: 0, target: 0 },
      ]);
      setPipelineData(pipelineStatusData.length > 0 ? pipelineStatusData.map(({ stage, stageLabel, count }) => ({
        stage,
        stageLabel,
        count,
      })) : [
        { stage: "Listed", stageLabel: "Listed", count: 0 },
        { stage: "Pre-Appointment Prep Done", stageLabel: "Pre-Appt Prep", count: 0 },
        { stage: "Discovery Meeting Done", stageLabel: "Discovery Meeting", count: 0 },
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number): string => {
    if (value >= 1000000) {
      return `₹${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `₹${(value / 1000).toFixed(1)}K`;
    }
    return `₹${value.toLocaleString("en-IN")}`;
  };

  const kpiCards = [
    {
      title: "Total Accounts",
      value: loading ? "..." : totalAccounts.toLocaleString("en-IN"),
      change: "",
      icon: Building2,
      color: "text-primary",
    },
    {
      title: "Active Contacts",
      value: loading ? "..." : totalContacts.toLocaleString("en-IN"),
      change: "",
      icon: Users,
      color: "text-accent",
    },
    {
      title: "Open Mandates",
      value: loading ? "..." : totalMandates.toLocaleString("en-IN"),
      change: "",
      icon: FileText,
      color: "text-warning",
    },
    {
      title: "Pipeline Value",
      value: loading ? "..." : formatCurrency(pipelineValue),
      change: "",
      icon: TrendingUp,
      color: "text-success",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here's an overview of your CRM performance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              {card.change && (
                <p className="text-xs text-success">
                  {card.change} from last month
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Achieved" />
                  <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" name="Planned" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={pipelineData} margin={{ bottom: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="stageLabel" 
                    className="text-xs" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120}
                    interval={0}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    formatter={(value: any) => [value, "Count"]}
                    labelFormatter={(label: string) => {
                      const fullStatus = pipelineData.find(d => d.stageLabel === label)?.stage || label;
                      return fullStatus;
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
