export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          address: string
          city: string | null
          company_size_tier:
            | Database["public"]["Enums"]["company_size_tier"]
            | null
          country: string | null
          created_at: string
          created_by: string | null
          founded_year: number
          id: string
          industry: string
          mcv_tier: Database["public"]["Enums"]["mcv_tier"] | null
          name: string
          revenue_range: string
          state: string | null
          sub_category: string
          total_acv: number | null
          total_mcv: number | null
          updated_at: string
          website: string
        }
        Insert: {
          address: string
          city?: string | null
          company_size_tier?:
            | Database["public"]["Enums"]["company_size_tier"]
            | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          founded_year: number
          id?: string
          industry: string
          mcv_tier?: Database["public"]["Enums"]["mcv_tier"] | null
          name: string
          revenue_range: string
          state?: string | null
          sub_category: string
          total_acv?: number | null
          total_mcv?: number | null
          updated_at?: string
          website: string
        }
        Update: {
          address?: string
          city?: string | null
          company_size_tier?:
            | Database["public"]["Enums"]["company_size_tier"]
            | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          founded_year?: number
          id?: string
          industry?: string
          mcv_tier?: Database["public"]["Enums"]["mcv_tier"] | null
          name?: string
          revenue_range?: string
          state?: string | null
          sub_category?: string
          total_acv?: number | null
          total_mcv?: number | null
          updated_at?: string
          website?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          account_id: string
          awign_champion: boolean
          created_at: string
          created_by: string | null
          department: string
          email: string
          first_name: string
          id: string
          kra: string | null
          last_name: string
          level: Database["public"]["Enums"]["contact_level"]
          phone_number: string
          positioning: string
          region: string | null
          reports_to: string | null
          title: string
          updated_at: string
          zone: string
        }
        Insert: {
          account_id: string
          awign_champion: boolean
          created_at?: string
          created_by?: string | null
          department: string
          email: string
          first_name: string
          id?: string
          kra?: string | null
          last_name: string
          level: Database["public"]["Enums"]["contact_level"]
          phone_number: string
          positioning: string
          region?: string | null
          reports_to?: string | null
          title: string
          updated_at?: string
          zone: string
        }
        Update: {
          account_id?: string
          awign_champion?: boolean
          created_at?: string
          created_by?: string | null
          department?: string
          email?: string
          first_name?: string
          id?: string
          kra?: string | null
          last_name?: string
          level?: Database["public"]["Enums"]["contact_level"]
          phone_number?: string
          positioning?: string
          region?: string | null
          reports_to?: string | null
          title?: string
          updated_at?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          created_at: string
          deal_id: string
          id: string
          new_status: string
          old_status: string | null
          sales_module_name: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          deal_id: string
          id?: string
          new_status: string
          old_status?: string | null
          sales_module_name: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          new_status?: string
          old_status?: string | null
          sales_module_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_status_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "pipeline_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      mandates: {
        Row: {
          account_id: string | null
          awign_share_percent:
            | Database["public"]["Enums"]["awign_share_percent"]
            | null
          client_budget_trend:
            | Database["public"]["Enums"]["client_budget_trend"]
            | null
          created_at: string
          created_by: string | null
          handover_acv: number | null
          handover_commercial_per_head: number | null
          handover_mcv: number | null
          handover_monthly_volume: number | null
          handover_prj_type: Database["public"]["Enums"]["prj_type"] | null
          id: string
          kam_id: string | null
          lob: Database["public"]["Enums"]["lob"]
          mandate_health: Database["public"]["Enums"]["mandate_health"] | null
          monthly_data: Json | null
          new_sales_owner: string | null
          prj_duration_months: number | null
          project_code: string
          project_name: string
          retention_type: Database["public"]["Enums"]["retention_type"] | null
          revenue_acv: number | null
          revenue_commercial_per_head: number | null
          revenue_mcv: number | null
          revenue_monthly_volume: number | null
          revenue_prj_type: Database["public"]["Enums"]["prj_type"] | null
          sub_use_case: Database["public"]["Enums"]["sub_use_case"] | null
          type: Database["public"]["Enums"]["mandate_type"] | null
          updated_at: string
          upsell_action_status:
            | Database["public"]["Enums"]["upsell_action_status"]
            | null
          upsell_constraint:
            | Database["public"]["Enums"]["upsell_constraint"]
            | null
          upsell_constraint_sub:
            | Database["public"]["Enums"]["upsell_constraint_sub"]
            | null
          upsell_constraint_sub2: string | null
          upsell_constraint_type:
            | Database["public"]["Enums"]["upsell_constraint_type"]
            | null
          use_case: Database["public"]["Enums"]["use_case"] | null
        }
        Insert: {
          account_id?: string | null
          awign_share_percent?:
            | Database["public"]["Enums"]["awign_share_percent"]
            | null
          client_budget_trend?:
            | Database["public"]["Enums"]["client_budget_trend"]
            | null
          created_at?: string
          created_by?: string | null
          handover_acv?: number | null
          handover_commercial_per_head?: number | null
          handover_mcv?: number | null
          handover_monthly_volume?: number | null
          handover_prj_type?: Database["public"]["Enums"]["prj_type"] | null
          id?: string
          kam_id?: string | null
          lob: Database["public"]["Enums"]["lob"]
          mandate_health?: Database["public"]["Enums"]["mandate_health"] | null
          monthly_data?: Json | null
          new_sales_owner?: string | null
          prj_duration_months?: number | null
          project_code: string
          project_name: string
          retention_type?: Database["public"]["Enums"]["retention_type"] | null
          revenue_acv?: number | null
          revenue_commercial_per_head?: number | null
          revenue_mcv?: number | null
          revenue_monthly_volume?: number | null
          revenue_prj_type?: Database["public"]["Enums"]["prj_type"] | null
          sub_use_case?: Database["public"]["Enums"]["sub_use_case"] | null
          type?: Database["public"]["Enums"]["mandate_type"] | null
          updated_at?: string
          upsell_action_status?:
            | Database["public"]["Enums"]["upsell_action_status"]
            | null
          upsell_constraint?:
            | Database["public"]["Enums"]["upsell_constraint"]
            | null
          upsell_constraint_sub?:
            | Database["public"]["Enums"]["upsell_constraint_sub"]
            | null
          upsell_constraint_sub2?: string | null
          upsell_constraint_type?:
            | Database["public"]["Enums"]["upsell_constraint_type"]
            | null
          use_case?: Database["public"]["Enums"]["use_case"] | null
        }
        Update: {
          account_id?: string | null
          awign_share_percent?:
            | Database["public"]["Enums"]["awign_share_percent"]
            | null
          client_budget_trend?:
            | Database["public"]["Enums"]["client_budget_trend"]
            | null
          created_at?: string
          created_by?: string | null
          handover_acv?: number | null
          handover_commercial_per_head?: number | null
          handover_mcv?: number | null
          handover_monthly_volume?: number | null
          handover_prj_type?: Database["public"]["Enums"]["prj_type"] | null
          id?: string
          kam_id?: string | null
          lob?: Database["public"]["Enums"]["lob"]
          mandate_health?: Database["public"]["Enums"]["mandate_health"] | null
          monthly_data?: Json | null
          new_sales_owner?: string | null
          prj_duration_months?: number | null
          project_code?: string
          project_name?: string
          retention_type?: Database["public"]["Enums"]["retention_type"] | null
          revenue_acv?: number | null
          revenue_commercial_per_head?: number | null
          revenue_mcv?: number | null
          revenue_monthly_volume?: number | null
          revenue_prj_type?: Database["public"]["Enums"]["prj_type"] | null
          sub_use_case?: Database["public"]["Enums"]["sub_use_case"] | null
          type?: Database["public"]["Enums"]["mandate_type"] | null
          updated_at?: string
          upsell_action_status?:
            | Database["public"]["Enums"]["upsell_action_status"]
            | null
          upsell_constraint?:
            | Database["public"]["Enums"]["upsell_constraint"]
            | null
          upsell_constraint_sub?:
            | Database["public"]["Enums"]["upsell_constraint_sub"]
            | null
          upsell_constraint_sub2?: string | null
          upsell_constraint_type?:
            | Database["public"]["Enums"]["upsell_constraint_type"]
            | null
          use_case?: Database["public"]["Enums"]["use_case"] | null
        }
        Relationships: [
          {
            foreignKeyName: "mandates_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandates_kam_id_fkey"
            columns: ["kam_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_targets: {
        Row: {
          account_id: string | null
          created_at: string
          created_by: string | null
          financial_year: string
          id: string
          kam_id: string | null
          mandate_id: string | null
          month: number
          target: number
          target_type: Database["public"]["Enums"]["target_type"]
          year: number
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          financial_year: string
          id?: string
          kam_id?: string | null
          mandate_id?: string | null
          month: number
          target: number
          target_type: Database["public"]["Enums"]["target_type"]
          year: number
        }
        Update: {
          account_id?: string | null
          created_at?: string
          created_by?: string | null
          financial_year?: string
          id?: string
          kam_id?: string | null
          mandate_id?: string | null
          month?: number
          target?: number
          target_type?: Database["public"]["Enums"]["target_type"]
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_targets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_targets_kam_id_fkey"
            columns: ["kam_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_targets_mandate_id_fkey"
            columns: ["mandate_id"]
            isOneToOne: false
            referencedRelation: "mandates"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_deals: {
        Row: {
          account_id: string | null
          commercial_per_head: number
          contract_sign_date: string | null
          created_at: string
          created_by: string | null
          discovery_meeting_slides: string | null
          dropped_reason: Database["public"]["Enums"]["dropped_reason"] | null
          dropped_reason_others: string | null
          expected_contract_sign_date: string | null
          expected_revenue: number
          final_proposal_slides: string | null
          gantt_chart_url: string | null
          gm_threshold: number | null
          id: string
          kam_id: string | null
          lob: Database["public"]["Enums"]["lob"]
          max_monthly_volume: number
          max_mpv: number
          monthly_volume: number
          mpv: number
          prj_duration_months: number
          prj_frequency: Database["public"]["Enums"]["prj_type"]
          prj_start_date: string
          probability: number
          sales_module_name: string
          signed_contract_link: string | null
          solution_proposal_slides: string | null
          spoc_id: string | null
          spoc2_id: string | null
          spoc3_id: string | null
          status: Database["public"]["Enums"]["pipeline_status"]
          sub_use_case: Database["public"]["Enums"]["sub_use_case"]
          updated_at: string
          use_case: Database["public"]["Enums"]["use_case"]
        }
        Insert: {
          account_id?: string | null
          commercial_per_head: number
          contract_sign_date?: string | null
          created_at?: string
          created_by?: string | null
          discovery_meeting_slides?: string | null
          dropped_reason?: Database["public"]["Enums"]["dropped_reason"] | null
          dropped_reason_others?: string | null
          expected_contract_sign_date?: string | null
          expected_revenue: number
          final_proposal_slides?: string | null
          gantt_chart_url?: string | null
          gm_threshold?: number | null
          id?: string
          kam_id?: string | null
          lob: Database["public"]["Enums"]["lob"]
          max_monthly_volume: number
          max_mpv: number
          monthly_volume: number
          mpv: number
          prj_duration_months: number
          prj_frequency: Database["public"]["Enums"]["prj_type"]
          prj_start_date: string
          probability?: number
          sales_module_name: string
          signed_contract_link?: string | null
          solution_proposal_slides?: string | null
          spoc_id?: string | null
          spoc2_id?: string | null
          spoc3_id?: string | null
          status?: Database["public"]["Enums"]["pipeline_status"]
          sub_use_case: Database["public"]["Enums"]["sub_use_case"]
          updated_at?: string
          use_case: Database["public"]["Enums"]["use_case"]
        }
        Update: {
          account_id?: string | null
          commercial_per_head?: number
          contract_sign_date?: string | null
          created_at?: string
          created_by?: string | null
          discovery_meeting_slides?: string | null
          dropped_reason?: Database["public"]["Enums"]["dropped_reason"] | null
          dropped_reason_others?: string | null
          expected_contract_sign_date?: string | null
          expected_revenue?: number
          final_proposal_slides?: string | null
          gantt_chart_url?: string | null
          gm_threshold?: number | null
          id?: string
          kam_id?: string | null
          lob?: Database["public"]["Enums"]["lob"]
          max_monthly_volume?: number
          max_mpv?: number
          monthly_volume?: number
          mpv?: number
          prj_duration_months?: number
          prj_frequency?: Database["public"]["Enums"]["prj_type"]
          prj_start_date?: string
          probability?: number
          sales_module_name?: string
          signed_contract_link?: string | null
          solution_proposal_slides?: string | null
          spoc_id?: string | null
          spoc2_id?: string | null
          spoc3_id?: string | null
          status?: Database["public"]["Enums"]["pipeline_status"]
          sub_use_case?: Database["public"]["Enums"]["sub_use_case"]
          updated_at?: string
          use_case?: Database["public"]["Enums"]["use_case"]
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_deals_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_deals_kam_id_fkey"
            columns: ["kam_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_deals_spoc_id_fkey"
            columns: ["spoc_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_deals_spoc2_id_fkey"
            columns: ["spoc2_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_deals_spoc3_id_fkey"
            columns: ["spoc3_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"] | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "kam" | "manager" | "leadership" | "superadmin"
      awign_share_percent: "Below 70%" | "70% & Above"
      client_budget_trend: "Increase" | "Same" | "Decrease"
      company_size_tier: "Tier 1" | "Tier 2"
      contact_level: "Lv.1" | "Lv.2" | "Lv.3"
      dropped_reason:
        | "Client Unresponsive"
        | "Requirement not feasible"
        | "Commercials above Client's Threshold"
        | "Others (put details below)"
      lob:
        | "Diligence & Audit"
        | "New Business Development"
        | "Digital Gigs"
        | "Awign Expert"
        | "Last Mile Operations"
        | "Invigilation & Proctoring"
        | "Staffing"
        | "Others"
      mandate_health:
        | "Exceeds Expectations"
        | "Meets Expectations"
        | "Need Improvement"
      mandate_type: "New Acquisition" | "New Cross Sell" | "Existing"
      mcv_tier: "Tier 1" | "Tier 2"
      pipeline_status:
        | "Listed"
        | "Pre-Appointment Prep Done"
        | "Discovery Meeting Done"
        | "Requirement Gathering Done"
        | "Solution Proposal Made"
        | "SOW Handshake Done"
        | "Final Proposal Done"
        | "Commercial Agreed"
        | "Closed Won"
        | "Dropped"
      prj_type: "Recurring" | "One-time"
      retention_type: "Star" | "A" | "B" | "C" | "D" | "E" | "NI"
      sub_use_case:
        | "Stock Audit"
        | "Store Audit"
        | "Warehouse Audit"
        | "Retail Outlet Audit"
        | "Distributor Audit"
        | "Others"
        | "-"
      target_type: "new_cross_sell" | "existing"
      upsell_action_status: "Not Started" | "Ongoing" | "Done"
      upsell_constraint: "YES" | "NO"
      upsell_constraint_sub:
        | "Profitability"
        | "Delivery"
        | "Others"
        | "-"
        | "Not enough demand"
        | "Collection Issue"
      upsell_constraint_sub2:
        | "GM too low"
        | "CoC (Cost of Capital too high)"
        | "Schedule too tight"
        | "Location too remote"
        | "-"
      upsell_constraint_type: "Internal" | "External" | "-"
      use_case:
        | "Mystery Audit"
        | "Non-Mystery Audit"
        | "Background Verification"
        | "Promoters Deployment"
        | "Fixed Resource Deployment"
        | "New Customer Acquisition"
        | "Retailer Activation"
        | "Society Activation"
        | "Content Operations"
        | "Telecalling"
        | "Market Survey"
        | "Edtech"
        | "SaaS"
        | "Others"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["kam", "manager", "leadership", "superadmin"],
      awign_share_percent: ["Below 70%", "70% & Above"],
      client_budget_trend: ["Increase", "Same", "Decrease"],
      company_size_tier: ["Tier 1", "Tier 2"],
      contact_level: ["Lv.1", "Lv.2", "Lv.3"],
      dropped_reason: [
        "Client Unresponsive",
        "Requirement not feasible",
        "Commercials above Client's Threshold",
        "Others (put details below)",
      ],
      lob: [
        "Diligence & Audit",
        "New Business Development",
        "Digital Gigs",
        "Awign Expert",
        "Last Mile Operations",
        "Invigilation & Proctoring",
        "Staffing",
        "Others",
      ],
      mandate_health: [
        "Exceeds Expectations",
        "Meets Expectations",
        "Need Improvement",
      ],
      mandate_type: ["New Acquisition", "New Cross Sell", "Existing"],
      mcv_tier: ["Tier 1", "Tier 2"],
      pipeline_status: [
        "Listed",
        "Pre-Appointment Prep Done",
        "Discovery Meeting Done",
        "Requirement Gathering Done",
        "Solution Proposal Made",
        "SOW Handshake Done",
        "Final Proposal Done",
        "Commercial Agreed",
        "Closed Won",
        "Dropped",
      ],
      prj_type: ["Recurring", "One-time"],
      retention_type: ["Star", "A", "B", "C", "D", "E", "NI"],
      sub_use_case: [
        "Stock Audit",
        "Store Audit",
        "Warehouse Audit",
        "Retail Outlet Audit",
        "Distributor Audit",
        "Others",
        "-",
      ],
      target_type: ["new_cross_sell", "existing"],
      upsell_action_status: ["Not Started", "Ongoing", "Done"],
      upsell_constraint: ["YES", "NO"],
      upsell_constraint_sub: [
        "Profitability",
        "Delivery",
        "Others",
        "-",
        "Not enough demand",
        "Collection Issue",
      ],
      upsell_constraint_sub2: [
        "GM too low",
        "CoC (Cost of Capital too high)",
        "Schedule too tight",
        "Location too remote",
        "-",
      ],
      upsell_constraint_type: ["Internal", "External", "-"],
      use_case: [
        "Mystery Audit",
        "Non-Mystery Audit",
        "Background Verification",
        "Promoters Deployment",
        "Fixed Resource Deployment",
        "New Customer Acquisition",
        "Retailer Activation",
        "Society Activation",
        "Content Operations",
        "Telecalling",
        "Market Survey",
        "Edtech",
        "SaaS",
        "Others",
      ],
    },
  },
} as const
