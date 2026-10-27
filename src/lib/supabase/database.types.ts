
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"full_name": string | null,"id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id": string,"role"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"full_name"?: string | null,"id"?: string,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"run_sections": {
                  Row: {
                    "id": string,"name": string,"position": number,"run_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"position": number,"run_id": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"position"?: number,"run_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "run_sections_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    }
                  ]
                },"run_tasks": {
                  Row: {
                    "assignee_id": string,"id": string,"name": string,"position": number,"required": boolean,"run_id": string,"section_id": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id": string,"id"?: string,"name": string,"position": number,"required": boolean,"run_id": string,"section_id": string,"status"?: string
                  }
                  Update: {
                    "assignee_id"?: string,"id"?: string,"name"?: string,"position"?: number,"required"?: boolean,"run_id"?: string,"section_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "run_tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "run_tasks_section_id_run_id_fkey"
      columns: ["section_id","run_id"]
isOneToOne: false
      referencedRelation: "run_sections"
      referencedColumns: ["id","run_id"]
    }
                  ]
                },"runs": {
                  Row: {
                    "case_name": string,"created_at": string,"id": string,"manager_id": string,"status": string,"template_id": string | null,"template_version": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "case_name": string,"created_at"?: string,"id"?: string,"manager_id": string,"status"?: string,"template_id"?: string | null,"template_version"?: number | null
                  }
                  Update: {
                    "case_name"?: string,"created_at"?: string,"id"?: string,"manager_id"?: string,"status"?: string,"template_id"?: string | null,"template_version"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "runs_manager_id_fkey"
      columns: ["manager_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "runs_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["id"]
    }
                  ]
                },"template_sections": {
                  Row: {
                    "id": string,"name": string,"position": number,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"position": number,"template_id": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"position"?: number,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_sections_template_id_fkey"
      columns: ["template_id"]
isOneToOne: false
      referencedRelation: "templates"
      referencedColumns: ["id"]
    }
                  ]
                },"template_tasks": {
                  Row: {
                    "id": string,"name": string,"position": number,"required": boolean,"section_id": string,"template_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"position": number,"required"?: boolean,"section_id": string,"template_id": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"position"?: number,"required"?: boolean,"section_id"?: string,"template_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "template_tasks_section_id_template_id_fkey"
      columns: ["section_id","template_id"]
isOneToOne: false
      referencedRelation: "template_sections"
      referencedColumns: ["id","template_id"]
    }
                  ]
                },"template_drafts": {
                  Row: {
                    "has_unpublished_changes": boolean,"template_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "has_unpublished_changes"?: boolean,"template_id": string,"updated_at"?: string
                  }
                  Update: {
                    "has_unpublished_changes"?: boolean,"template_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"template_version_sections": {
                  Row: {
                    "id": string,"name": string,"position": number,"template_id": string,"version": number,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"position": number,"template_id": string,"version": number,"version_id": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"position"?: number,"template_id"?: string,"version"?: number,"version_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"template_version_tasks": {
                  Row: {
                    "id": string,"name": string,"position": number,"required": boolean,"section_id": string,"version_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"position": number,"required": boolean,"section_id": string,"version_id": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"position"?: number,"required"?: boolean,"section_id"?: string,"version_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"template_versions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"template_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"template_id": string,"version": number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"template_id"?: string,"version"?: number
                  }
                  Relationships: [
                    
                  ]
                },"templates": {
                  Row: {
                    "created_at": string,"current_version": number | null,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_version"?: number | null,"id"?: string,"name": string
                  }
                  Update: {
                    "created_at"?: string,"current_version"?: number | null,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "create_template":
{ Args: { "p_name": string }; Returns: string
                           },
"launch_run":
{ Args: { "p_assignments"?: Json,"p_case_name": string,"p_template_id": string }; Returns: string
                           },
"list_assignable_users":
{ Args: Record<PropertyKey, never>; Returns: {
              "email": string,"id": string
            }[]
                           },
"mark_task_done":
{ Args: { "p_task_id": string }; Returns: undefined
                           },
"publish_template":
{ Args: { "p_template_id": string }; Returns: number
                           },
"save_template_draft":
{ Args: { "p_content": Json,"p_template_id": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const