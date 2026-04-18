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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assessment_questions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          reversed: boolean
          sort_order: number
          text: string
          trait: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          reversed?: boolean
          sort_order?: number
          text: string
          trait: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          reversed?: boolean
          sort_order?: number
          text?: string
          trait?: string
          updated_at?: string
        }
        Relationships: []
      }
      assessments: {
        Row: {
          ai_analysis: Json | null
          candidate_email: string | null
          candidate_name: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          evaluation_id: string | null
          id: string
          job_role: string | null
          ocean_scores: Json | null
          status: Database["public"]["Enums"]["assessment_status"]
          updated_at: string
          uuid_token: string
        }
        Insert: {
          ai_analysis?: Json | null
          candidate_email?: string | null
          candidate_name?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          evaluation_id?: string | null
          id?: string
          job_role?: string | null
          ocean_scores?: Json | null
          status?: Database["public"]["Enums"]["assessment_status"]
          updated_at?: string
          uuid_token?: string
        }
        Update: {
          ai_analysis?: Json | null
          candidate_email?: string | null
          candidate_name?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          evaluation_id?: string | null
          id?: string
          job_role?: string | null
          ocean_scores?: Json | null
          status?: Database["public"]["Enums"]["assessment_status"]
          updated_at?: string
          uuid_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          candidate_name: string | null
          color: string | null
          created_at: string
          description: string | null
          end_at: string
          id: string
          is_shared: boolean
          kind: Database["public"]["Enums"]["calendar_event_kind"]
          owner_id: string
          plan_entry_id: string | null
          plan_integration_id: string | null
          source: string
          start_at: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          candidate_name?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_at: string
          id?: string
          is_shared?: boolean
          kind?: Database["public"]["Enums"]["calendar_event_kind"]
          owner_id: string
          plan_entry_id?: string | null
          plan_integration_id?: string | null
          source?: string
          start_at: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          candidate_name?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_at?: string
          id?: string
          is_shared?: boolean
          kind?: Database["public"]["Enums"]["calendar_event_kind"]
          owner_id?: string
          plan_entry_id?: string | null
          plan_integration_id?: string | null
          source?: string
          start_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cv_analyses: {
        Row: {
          candidate_details: Json
          competences_cles: Json
          created_at: string
          cv_file_path: string | null
          cv_raw_text: string | null
          email: string | null
          id: string
          matching_score: number
          nom_candidat: string
          poste_assigne: string
          session_id: string
          synthese_ia: string
          updated_at: string
        }
        Insert: {
          candidate_details?: Json
          competences_cles?: Json
          created_at?: string
          cv_file_path?: string | null
          cv_raw_text?: string | null
          email?: string | null
          id?: string
          matching_score?: number
          nom_candidat?: string
          poste_assigne?: string
          session_id?: string
          synthese_ia?: string
          updated_at?: string
        }
        Update: {
          candidate_details?: Json
          competences_cles?: Json
          created_at?: string
          cv_file_path?: string | null
          cv_raw_text?: string | null
          email?: string | null
          id?: string
          matching_score?: number
          nom_candidat?: string
          poste_assigne?: string
          session_id?: string
          synthese_ia?: string
          updated_at?: string
        }
        Relationships: []
      }
      cvs_retenus: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      evaluations: {
        Row: {
          candidate_name: string
          candidate_source: string
          comments: string | null
          created_at: string
          decision: string | null
          evaluation_date: string
          id: string
          interviewer_name: string | null
          job_role_config_id: string | null
          location: string | null
          recruitment_reason: string
          recruitment_type: string
          scores: Json
          updated_at: string
        }
        Insert: {
          candidate_name: string
          candidate_source?: string
          comments?: string | null
          created_at?: string
          decision?: string | null
          evaluation_date?: string
          id?: string
          interviewer_name?: string | null
          job_role_config_id?: string | null
          location?: string | null
          recruitment_reason?: string
          recruitment_type?: string
          scores?: Json
          updated_at?: string
        }
        Update: {
          candidate_name?: string
          candidate_source?: string
          comments?: string | null
          created_at?: string
          decision?: string | null
          evaluation_date?: string
          id?: string
          interviewer_name?: string | null
          job_role_config_id?: string | null
          location?: string | null
          recruitment_reason?: string
          recruitment_type?: string
          scores?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_job_role_config_id_fkey"
            columns: ["job_role_config_id"]
            isOneToOne: false
            referencedRelation: "job_role_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      fiches_embauche: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      fiches_poste: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_role_configs: {
        Row: {
          categories: Json
          created_at: string
          id: string
          name: string
          scale_max: number
          updated_at: string
        }
        Insert: {
          categories?: Json
          created_at?: string
          id?: string
          name: string
          scale_max?: number
          updated_at?: string
        }
        Update: {
          categories?: Json
          created_at?: string
          id?: string
          name?: string
          scale_max?: number
          updated_at?: string
        }
        Relationships: []
      }
      plans_integration: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_approved: boolean
          signature_url: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          is_approved?: boolean
          signature_url?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_approved?: boolean
          signature_url?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signature_requests: {
        Row: {
          created_at: string
          doc_id: string
          doc_title: string
          doc_type: Database["public"]["Enums"]["signature_doc_type"]
          id: string
          message: string | null
          recipient_id: string
          requester_id: string
          responded_at: string | null
          signature_url: string | null
          status: Database["public"]["Enums"]["signature_request_status"]
        }
        Insert: {
          created_at?: string
          doc_id: string
          doc_title?: string
          doc_type: Database["public"]["Enums"]["signature_doc_type"]
          id?: string
          message?: string | null
          recipient_id: string
          requester_id: string
          responded_at?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["signature_request_status"]
        }
        Update: {
          created_at?: string
          doc_id?: string
          doc_title?: string
          doc_type?: Database["public"]["Enums"]["signature_doc_type"]
          id?: string
          message?: string | null
          recipient_id?: string
          requester_id?: string
          responded_at?: string | null
          signature_url?: string | null
          status?: Database["public"]["Enums"]["signature_request_status"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
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
      is_approved: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      assessment_status: "pending" | "completed" | "analyzed"
      calendar_event_kind:
        | "meeting"
        | "interview"
        | "onboarding"
        | "task"
        | "reminder"
        | "other"
      signature_doc_type:
        | "evaluation"
        | "fiche_embauche"
        | "fiche_poste"
        | "plan_integration"
      signature_request_status: "pending" | "accepted" | "declined"
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
      app_role: ["admin", "user"],
      assessment_status: ["pending", "completed", "analyzed"],
      calendar_event_kind: [
        "meeting",
        "interview",
        "onboarding",
        "task",
        "reminder",
        "other",
      ],
      signature_doc_type: [
        "evaluation",
        "fiche_embauche",
        "fiche_poste",
        "plan_integration",
      ],
      signature_request_status: ["pending", "accepted", "declined"],
    },
  },
} as const
