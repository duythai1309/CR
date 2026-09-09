/**
 * Kiểu sinh tự động từ schema Supabase — KHÔNG sửa tay.
 *
 * Sinh lại bằng MCP `generate_typescript_types` sau mỗi lần áp migration. Bản này được
 * sinh sau khi áp 0018 (phiên hỗ trợ vận hành, RPC tên người duyệt) và 0019 (VM0051),
 * nên đã có `project_support_sessions`, `begin_project_support` và
 * `project_stage_approval_directory`.
 */
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
      batch_items: {
        Row: {
          batch_id: string
          co2e_t: number
          emission_calculation_id: string
          field_season_id: string
          id: string
        }
        Insert: {
          batch_id: string
          co2e_t: number
          emission_calculation_id: string
          field_season_id: string
          id?: string
        }
        Update: {
          batch_id?: string
          co2e_t?: number
          emission_calculation_id?: string
          field_season_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "credit_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_emission_calculation_id_fkey"
            columns: ["emission_calculation_id"]
            isOneToOne: false
            referencedRelation: "emission_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_items_field_season_id_fkey"
            columns: ["field_season_id"]
            isOneToOne: false
            referencedRelation: "field_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          cooperative_id: string | null
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cooperative_id?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cooperative_id?: string | null
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["chat_role"]
          tool_calls: Json | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["chat_role"]
          tool_calls?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["chat_role"]
          tool_calls?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_settings: {
        Row: {
          api_key: string | null
          api_key_last4: string | null
          id: boolean
          model: string | null
          provider: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key?: string | null
          api_key_last4?: string | null
          id?: boolean
          model?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string | null
          api_key_last4?: string | null
          id?: boolean
          model?: string | null
          provider?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperatives: {
        Row: {
          code: string
          commune: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          district: string | null
          id: string
          name: string
          province: string
          region: Database["public"]["Enums"]["vn_region"] | null
        }
        Insert: {
          code: string
          commune?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          district?: string | null
          id?: string
          name: string
          province: string
          region?: Database["public"]["Enums"]["vn_region"] | null
        }
        Update: {
          code?: string
          commune?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          district?: string | null
          id?: string
          name?: string
          province?: string
          region?: Database["public"]["Enums"]["vn_region"] | null
        }
        Relationships: []
      }
      credit_batches: {
        Row: {
          buffer_pct: number
          code: string
          coop_admin_fee_pct: number
          cooperative_id: string
          created_at: string
          description: string | null
          gross_co2e_t: number
          id: string
          issuable_co2e_t: number
          listed_at: string | null
          name: string
          platform_fee_pct: number
          price_per_t_vnd: number | null
          season_id: string | null
          sold_co2e_t: number
          status: Database["public"]["Enums"]["batch_status"]
        }
        Insert: {
          buffer_pct?: number
          code: string
          coop_admin_fee_pct?: number
          cooperative_id: string
          created_at?: string
          description?: string | null
          gross_co2e_t?: number
          id?: string
          issuable_co2e_t?: number
          listed_at?: string | null
          name: string
          platform_fee_pct?: number
          price_per_t_vnd?: number | null
          season_id?: string | null
          sold_co2e_t?: number
          status?: Database["public"]["Enums"]["batch_status"]
        }
        Update: {
          buffer_pct?: number
          code?: string
          coop_admin_fee_pct?: number
          cooperative_id?: string
          created_at?: string
          description?: string | null
          gross_co2e_t?: number
          id?: string
          issuable_co2e_t?: number
          listed_at?: string | null
          name?: string
          platform_fee_pct?: number
          price_per_t_vnd?: number | null
          season_id?: string | null
          sold_co2e_t?: number
          status?: Database["public"]["Enums"]["batch_status"]
        }
        Relationships: [
          {
            foreignKeyName: "credit_batches_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_batches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      emission_calculations: {
        Row: {
          area_ha: number
          baseline_burning_co2e_t: number
          baseline_ch4_kg: number
          baseline_co2e_t: number
          baseline_n2o_kg: number
          computed_at: string
          computed_by: string | null
          cooperative_id: string
          cultivation_days: number
          factors: Json
          field_season_id: string
          id: string
          inputs: Json
          is_current: boolean
          methodology_version: string
          project_burning_co2e_t: number
          project_ch4_kg: number
          project_co2e_t: number
          project_n2o_kg: number
          reduction_co2e_t: number
        }
        Insert: {
          area_ha: number
          baseline_burning_co2e_t?: number
          baseline_ch4_kg: number
          baseline_co2e_t: number
          baseline_n2o_kg: number
          computed_at?: string
          computed_by?: string | null
          cooperative_id: string
          cultivation_days: number
          factors: Json
          field_season_id: string
          id?: string
          inputs: Json
          is_current?: boolean
          methodology_version: string
          project_burning_co2e_t?: number
          project_ch4_kg: number
          project_co2e_t: number
          project_n2o_kg: number
          reduction_co2e_t: number
        }
        Update: {
          area_ha?: number
          baseline_burning_co2e_t?: number
          baseline_ch4_kg?: number
          baseline_co2e_t?: number
          baseline_n2o_kg?: number
          computed_at?: string
          computed_by?: string | null
          cooperative_id?: string
          cultivation_days?: number
          factors?: Json
          field_season_id?: string
          id?: string
          inputs?: Json
          is_current?: boolean
          methodology_version?: string
          project_burning_co2e_t?: number
          project_ch4_kg?: number
          project_co2e_t?: number
          project_n2o_kg?: number
          reduction_co2e_t?: number
        }
        Relationships: [
          {
            foreignKeyName: "emission_calculations_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emission_calculations_field_season_id_fkey"
            columns: ["field_season_id"]
            isOneToOne: false
            referencedRelation: "field_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      emission_factors: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          source: string | null
          unit: string | null
          value: number
          version: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          source?: string | null
          unit?: string | null
          value: number
          version: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          source?: string | null
          unit?: string | null
          value?: number
          version?: string
        }
        Relationships: []
      }
      evidence_photos: {
        Row: {
          caption: string | null
          cooperative_id: string
          created_at: string
          field_season_id: string
          id: string
          lat: number | null
          lng: number | null
          storage_path: string
          taken_at: string | null
        }
        Insert: {
          caption?: string | null
          cooperative_id: string
          created_at?: string
          field_season_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          storage_path: string
          taken_at?: string | null
        }
        Update: {
          caption?: string | null
          cooperative_id?: string
          created_at?: string
          field_season_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          storage_path?: string
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_photos_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_photos_field_season_id_fkey"
            columns: ["field_season_id"]
            isOneToOne: false
            referencedRelation: "field_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      farmers: {
        Row: {
          cooperative_id: string
          created_at: string
          full_name: string
          id: string
          member_code: string | null
          phone: string | null
          village: string | null
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          full_name: string
          id?: string
          member_code?: string | null
          phone?: string | null
          village?: string | null
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          full_name?: string
          id?: string
          member_code?: string | null
          phone?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "farmers_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      fertilizer_applications: {
        Row: {
          amount_kg: number
          applied_date: string
          cooperative_id: string
          created_at: string
          dry_matter_pct: number | null
          field_season_id: string
          id: string
          is_organic: boolean
          n_content_pct: number
          note: string | null
          organic_type: Database["public"]["Enums"]["organic_amendment"] | null
          product_name: string | null
        }
        Insert: {
          amount_kg: number
          applied_date: string
          cooperative_id: string
          created_at?: string
          dry_matter_pct?: number | null
          field_season_id: string
          id?: string
          is_organic?: boolean
          n_content_pct?: number
          note?: string | null
          organic_type?: Database["public"]["Enums"]["organic_amendment"] | null
          product_name?: string | null
        }
        Update: {
          amount_kg?: number
          applied_date?: string
          cooperative_id?: string
          created_at?: string
          dry_matter_pct?: number | null
          field_season_id?: string
          id?: string
          is_organic?: boolean
          n_content_pct?: number
          note?: string | null
          organic_type?: Database["public"]["Enums"]["organic_amendment"] | null
          product_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fertilizer_applications_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fertilizer_applications_field_season_id_fkey"
            columns: ["field_season_id"]
            isOneToOne: false
            referencedRelation: "field_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      field_seasons: {
        Row: {
          baseline_water_regime: Database["public"]["Enums"]["water_regime"]
          cooperative_id: string
          created_at: string
          field_id: string
          harvest_date: string | null
          id: string
          is_locked: boolean
          preseason_water: Database["public"]["Enums"]["preseason_water"]
          season_id: string
          transplant_date: string | null
        }
        Insert: {
          baseline_water_regime?: Database["public"]["Enums"]["water_regime"]
          cooperative_id: string
          created_at?: string
          field_id: string
          harvest_date?: string | null
          id?: string
          is_locked?: boolean
          preseason_water?: Database["public"]["Enums"]["preseason_water"]
          season_id: string
          transplant_date?: string | null
        }
        Update: {
          baseline_water_regime?: Database["public"]["Enums"]["water_regime"]
          cooperative_id?: string
          created_at?: string
          field_id?: string
          harvest_date?: string | null
          id?: string
          is_locked?: boolean
          preseason_water?: Database["public"]["Enums"]["preseason_water"]
          season_id?: string
          transplant_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "field_seasons_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_seasons_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_seasons_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "fields_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "field_seasons_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      fields: {
        Row: {
          area_ha: number | null
          cooperative_id: string
          created_at: string
          declared_area_ha: number | null
          farmer_id: string
          geom: unknown
          id: string
          name: string
          soil_type: string | null
        }
        Insert: {
          area_ha?: number | null
          cooperative_id: string
          created_at?: string
          declared_area_ha?: number | null
          farmer_id: string
          geom?: unknown
          id?: string
          name: string
          soil_type?: string | null
        }
        Update: {
          area_ha?: number | null
          cooperative_id?: string
          created_at?: string
          declared_area_ha?: number | null
          farmer_id?: string
          geom?: unknown
          id?: string
          name?: string
          soil_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fields_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fields_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      methodologies: {
        Row: {
          code: string
          created_at: string
          disclaimer: string
          id: string
          is_sample: boolean
          metric_schema: Json
          name: string
          professionally_validated: boolean
          project_type: string
          published_at: string | null
          schema_hash: string | null
          standard_id: string
          status: string
          version: string
        }
        Insert: {
          code: string
          created_at?: string
          disclaimer: string
          id?: string
          is_sample?: boolean
          metric_schema: Json
          name: string
          professionally_validated?: boolean
          project_type: string
          published_at?: string | null
          schema_hash?: string | null
          standard_id: string
          status?: string
          version: string
        }
        Update: {
          code?: string
          created_at?: string
          disclaimer?: string
          id?: string
          is_sample?: boolean
          metric_schema?: Json
          name?: string
          professionally_validated?: boolean
          project_type?: string
          published_at?: string | null
          schema_hash?: string | null
          standard_id?: string
          status?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "methodologies_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
        ]
      }
      methodology_factors: {
        Row: {
          id: string
          key: string
          methodology_id: string
          scope: Json
          source: string
          unit: string
          value: number
        }
        Insert: {
          id?: string
          key: string
          methodology_id: string
          scope?: Json
          source: string
          unit: string
          value: number
        }
        Update: {
          id?: string
          key?: string
          methodology_id?: string
          scope?: Json
          source?: string
          unit?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "methodology_factors_methodology_id_fkey"
            columns: ["methodology_id"]
            isOneToOne: false
            referencedRelation: "methodologies"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_data: {
        Row: {
          entered_by: string
          id: string
          import_id: string | null
          metric_values: Json
          observed_on: string
          period_id: string
          project_id: string
          raw_input: Json
          record_key: string
          revision: number
          source_row: number | null
          updated_at: string
        }
        Insert: {
          entered_by: string
          id?: string
          import_id?: string | null
          metric_values: Json
          observed_on: string
          period_id: string
          project_id: string
          raw_input?: Json
          record_key: string
          revision: number
          source_row?: number | null
          updated_at?: string
        }
        Update: {
          entered_by?: string
          id?: string
          import_id?: string | null
          metric_values?: Json
          observed_on?: string
          period_id?: string
          project_id?: string
          raw_input?: Json
          record_key?: string
          revision?: number
          source_row?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_data_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_data_import_id_period_id_project_id_fkey"
            columns: ["import_id", "period_id", "project_id"]
            isOneToOne: false
            referencedRelation: "monitoring_imports"
            referencedColumns: ["id", "period_id", "project_id"]
          },
          {
            foreignKeyName: "monitoring_data_period_id_project_id_fkey"
            columns: ["period_id", "project_id"]
            isOneToOne: false
            referencedRelation: "monitoring_periods"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "monitoring_data_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_imports: {
        Row: {
          created_at: string
          file_id: string
          id: string
          imported_by: string
          mapping: Json
          mapping_hash: string | null
          period_id: string
          project_id: string
          schema_hash: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          imported_by: string
          mapping: Json
          mapping_hash?: string | null
          period_id: string
          project_id: string
          schema_hash: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          imported_by?: string
          mapping?: Json
          mapping_hash?: string | null
          period_id?: string
          project_id?: string
          schema_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_imports_file_id_project_id_fkey"
            columns: ["file_id", "project_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "monitoring_imports_imported_by_fkey"
            columns: ["imported_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_imports_period_id_project_id_fkey"
            columns: ["period_id", "project_id"]
            isOneToOne: false
            referencedRelation: "monitoring_periods"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "monitoring_imports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_periods: {
        Row: {
          baseline_revision: number
          baseline_snapshot: Json
          created_at: string
          created_by: string
          data_revision: number
          data_snapshot: Json | null
          end_date: string
          factors_snapshot: Json
          id: string
          locked_at: string | null
          methodology_id: string
          name: string
          project_id: string
          schema_hash: string
          schema_snapshot: Json
          standard_id: string
          start_date: string
          status: string
          version: number
        }
        Insert: {
          baseline_revision: number
          baseline_snapshot: Json
          created_at?: string
          created_by: string
          data_revision?: number
          data_snapshot?: Json | null
          end_date: string
          factors_snapshot: Json
          id?: string
          locked_at?: string | null
          methodology_id: string
          name: string
          project_id: string
          schema_hash: string
          schema_snapshot: Json
          standard_id: string
          start_date: string
          status?: string
          version?: number
        }
        Update: {
          baseline_revision?: number
          baseline_snapshot?: Json
          created_at?: string
          created_by?: string
          data_revision?: number
          data_snapshot?: Json | null
          end_date?: string
          factors_snapshot?: Json
          id?: string
          locked_at?: string | null
          methodology_id?: string
          name?: string
          project_id?: string
          schema_hash?: string
          schema_snapshot?: Json
          standard_id?: string
          start_date?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "monitoring_periods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_periods_methodology_id_standard_id_fkey"
            columns: ["methodology_id", "standard_id"]
            isOneToOne: false
            referencedRelation: "methodologies"
            referencedColumns: ["id", "standard_id"]
          },
          {
            foreignKeyName: "monitoring_periods_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monitoring_periods_project_id_methodology_id_standard_id_fkey"
            columns: ["project_id", "methodology_id", "standard_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id", "methodology_id", "standard_id"]
          },
        ]
      }
      mrv_reports: {
        Row: {
          baseline_revision: number
          baseline_snapshot: Json
          calculation_trace: Json
          data_revision: number
          engine_version: string
          factors_snapshot: Json
          generated_at: string
          id: string
          input_snapshot: Json
          methodology_id: string
          output_file_id: string | null
          period_id: string
          project_id: string
          requested_by: string
          results: Json
          schema_hash: string
          schema_snapshot: Json
          standard_id: string
          status: string
          template_id: string
          template_snapshot: Json
          version: number
        }
        Insert: {
          baseline_revision: number
          baseline_snapshot: Json
          calculation_trace: Json
          data_revision: number
          engine_version: string
          factors_snapshot: Json
          generated_at?: string
          id?: string
          input_snapshot: Json
          methodology_id: string
          output_file_id?: string | null
          period_id: string
          project_id: string
          requested_by: string
          results: Json
          schema_hash: string
          schema_snapshot: Json
          standard_id: string
          status: string
          template_id: string
          template_snapshot: Json
          version: number
        }
        Update: {
          baseline_revision?: number
          baseline_snapshot?: Json
          calculation_trace?: Json
          data_revision?: number
          engine_version?: string
          factors_snapshot?: Json
          generated_at?: string
          id?: string
          input_snapshot?: Json
          methodology_id?: string
          output_file_id?: string | null
          period_id?: string
          project_id?: string
          requested_by?: string
          results?: Json
          schema_hash?: string
          schema_snapshot?: Json
          standard_id?: string
          status?: string
          template_id?: string
          template_snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "mrv_reports_output_file_id_project_id_fkey"
            columns: ["output_file_id", "project_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "mrv_reports_period_id_project_id_methodology_id_standard_i_fkey"
            columns: [
              "period_id",
              "project_id",
              "methodology_id",
              "standard_id",
            ]
            isOneToOne: false
            referencedRelation: "monitoring_periods"
            referencedColumns: [
              "id",
              "project_id",
              "methodology_id",
              "standard_id",
            ]
          },
          {
            foreignKeyName: "mrv_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrv_reports_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mrv_reports_template_id_methodology_id_standard_id_fkey"
            columns: ["template_id", "methodology_id", "standard_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id", "methodology_id", "standard_id"]
          },
        ]
      }
      orders: {
        Row: {
          batch_id: string
          buyer_id: string
          buyer_note: string | null
          code: string
          created_at: string
          id: string
          quantity_co2e_t: number
          status: Database["public"]["Enums"]["order_status"]
          total_vnd: number
          unit_price_vnd: number
        }
        Insert: {
          batch_id: string
          buyer_id: string
          buyer_note?: string | null
          code: string
          created_at?: string
          id?: string
          quantity_co2e_t: number
          status?: Database["public"]["Enums"]["order_status"]
          total_vnd: number
          unit_price_vnd: number
        }
        Update: {
          batch_id?: string
          buyer_id?: string
          buyer_note?: string | null
          code?: string
          created_at?: string
          id?: string
          quantity_co2e_t?: number
          status?: Database["public"]["Enums"]["order_status"]
          total_vnd?: number
          unit_price_vnd?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "credit_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_vnd: number
          created_at: string
          failure_reason: string | null
          id: string
          order_id: string
          paid_at: string | null
          provider: string
          provider_ref: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount_vnd: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          order_id: string
          paid_at?: string | null
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount_vnd?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          order_id?: string
          paid_at?: string | null
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_name: string | null
          cooperative_id: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          company_name?: string | null
          cooperative_id?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          company_name?: string | null
          cooperative_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          created_at: string
          file_id: string
          id: string
          kind: string
          project_id: string
          stage_id: string
          version: number
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          kind: string
          project_id: string
          stage_id: string
          version: number
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          kind?: string
          project_id?: string
          stage_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_documents_file_id_project_id_fkey"
            columns: ["file_id", "project_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "project_documents_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_documents_stage_id_project_id_fkey"
            columns: ["stage_id", "project_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      project_files: {
        Row: {
          bucket_id: string
          checksum: string
          created_at: string
          id: string
          mime_type: string
          object_path: string
          original_name: string
          project_id: string
          size_bytes: number
          uploaded_by: string
        }
        Insert: {
          bucket_id?: string
          checksum: string
          created_at?: string
          id?: string
          mime_type: string
          object_path: string
          original_name: string
          project_id: string
          size_bytes: number
          uploaded_by?: string
        }
        Update: {
          bucket_id?: string
          checksum?: string
          created_at?: string
          id?: string
          mime_type?: string
          object_path?: string
          original_name?: string
          project_id?: string
          size_bytes?: number
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          joined_at: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          joined_at?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_stages: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          id: string
          ordinal: number
          project_id: string
          title: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          ordinal: number
          project_id: string
          title: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          ordinal?: number
          project_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_stages_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_stages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_support_sessions: {
        Row: {
          admin_id: string
          expires_at: string
          id: string
          opened_at: string
          project_id: string
          reason: string
        }
        Insert: {
          admin_id: string
          expires_at: string
          id?: string
          opened_at?: string
          project_id: string
          reason: string
        }
        Update: {
          admin_id?: string
          expires_at?: string
          id?: string
          opened_at?: string
          project_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_support_sessions_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_support_sessions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assignee_id: string | null
          assignee_role: string
          created_at: string
          created_by: string
          description: string
          due_at: string | null
          id: string
          position: number
          project_id: string
          stage_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_role?: string
          created_at?: string
          created_by?: string
          description?: string
          due_at?: string | null
          id?: string
          position?: number
          project_id: string
          stage_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          assignee_role?: string
          created_at?: string
          created_by?: string
          description?: string
          due_at?: string | null
          id?: string
          position?: number
          project_id?: string
          stage_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_assignee_id_assignee_role_fkey"
            columns: ["project_id", "assignee_id", "assignee_role"]
            isOneToOne: false
            referencedRelation: "project_members"
            referencedColumns: ["project_id", "user_id", "role"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_stage_id_project_id_fkey"
            columns: ["stage_id", "project_id"]
            isOneToOne: false
            referencedRelation: "project_stages"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      projects: {
        Row: {
          baseline: Json
          baseline_revision: number
          created_at: string
          created_by: string
          deleted_at: string | null
          description: string
          id: string
          membership_revision: number
          methodology_id: string | null
          methodology_locked_at: string | null
          name: string
          setup: Json
          standard_id: string | null
          standard_locked_at: string | null
          updated_at: string
        }
        Insert: {
          baseline?: Json
          baseline_revision?: number
          created_at?: string
          created_by: string
          deleted_at?: string | null
          description?: string
          id?: string
          membership_revision?: number
          methodology_id?: string | null
          methodology_locked_at?: string | null
          name: string
          setup?: Json
          standard_id?: string | null
          standard_locked_at?: string | null
          updated_at?: string
        }
        Update: {
          baseline?: Json
          baseline_revision?: number
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          description?: string
          id?: string
          membership_revision?: number
          methodology_id?: string | null
          methodology_locked_at?: string | null
          name?: string
          setup?: Json
          standard_id?: string | null
          standard_locked_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_methodology_id_standard_id_fkey"
            columns: ["methodology_id", "standard_id"]
            isOneToOne: false
            referencedRelation: "methodologies"
            referencedColumns: ["id", "standard_id"]
          },
          {
            foreignKeyName: "projects_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          bucket_id: string
          checksum: string | null
          created_at: string
          disclaimer: string
          format: string
          id: string
          mapping: Json
          methodology_id: string
          object_path: string | null
          standard_id: string
          status: string
          version: string
        }
        Insert: {
          bucket_id?: string
          checksum?: string | null
          created_at?: string
          disclaimer: string
          format: string
          id?: string
          mapping?: Json
          methodology_id: string
          object_path?: string | null
          standard_id: string
          status?: string
          version: string
        }
        Update: {
          bucket_id?: string
          checksum?: string | null
          created_at?: string
          disclaimer?: string
          format?: string
          id?: string
          mapping?: Json
          methodology_id?: string
          object_path?: string | null
          standard_id?: string
          status?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_methodology_id_standard_id_fkey"
            columns: ["methodology_id", "standard_id"]
            isOneToOne: false
            referencedRelation: "methodologies"
            referencedColumns: ["id", "standard_id"]
          },
          {
            foreignKeyName: "report_templates_standard_id_fkey"
            columns: ["standard_id"]
            isOneToOne: false
            referencedRelation: "standards"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_shares: {
        Row: {
          breakdown: Json
          cooperative_amount_vnd: number
          created_at: string
          farmer_amount_vnd: number
          id: string
          order_id: string
          platform_amount_vnd: number
        }
        Insert: {
          breakdown: Json
          cooperative_amount_vnd: number
          created_at?: string
          farmer_amount_vnd: number
          id?: string
          order_id: string
          platform_amount_vnd: number
        }
        Update: {
          breakdown?: Json
          cooperative_amount_vnd?: number
          created_at?: string
          farmer_amount_vnd?: number
          id?: string
          order_id?: string
          platform_amount_vnd?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_shares_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          cooperative_id: string
          created_at: string
          crop: Database["public"]["Enums"]["crop_type"]
          end_date: string | null
          id: string
          is_locked: boolean
          name: string
          season_type: Database["public"]["Enums"]["season_type"] | null
          start_date: string
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          crop?: Database["public"]["Enums"]["crop_type"]
          end_date?: string | null
          id?: string
          is_locked?: boolean
          name: string
          season_type?: Database["public"]["Enums"]["season_type"] | null
          start_date: string
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          crop?: Database["public"]["Enums"]["crop_type"]
          end_date?: string | null
          id?: string
          is_locked?: boolean
          name?: string
          season_type?: Database["public"]["Enums"]["season_type"] | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
        ]
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      standards: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      straw_management: {
        Row: {
          amount_t_per_ha: number | null
          baseline_method: Database["public"]["Enums"]["straw_method"]
          cooperative_id: string
          created_at: string
          days_before_cultivation: number | null
          field_season_id: string
          id: string
          method: Database["public"]["Enums"]["straw_method"]
          note: string | null
        }
        Insert: {
          amount_t_per_ha?: number | null
          baseline_method?: Database["public"]["Enums"]["straw_method"]
          cooperative_id: string
          created_at?: string
          days_before_cultivation?: number | null
          field_season_id: string
          id?: string
          method: Database["public"]["Enums"]["straw_method"]
          note?: string | null
        }
        Update: {
          amount_t_per_ha?: number | null
          baseline_method?: Database["public"]["Enums"]["straw_method"]
          cooperative_id?: string
          created_at?: string
          days_before_cultivation?: number | null
          field_season_id?: string
          id?: string
          method?: Database["public"]["Enums"]["straw_method"]
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "straw_management_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "straw_management_field_season_id_fkey"
            columns: ["field_season_id"]
            isOneToOne: true
            referencedRelation: "field_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_id: string
          id: string
          project_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          project_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          project_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_file_id_project_id_fkey"
            columns: ["file_id", "project_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id", "project_id"]
          },
          {
            foreignKeyName: "task_attachments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_project_id_fkey"
            columns: ["task_id", "project_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          project_id: string
          task_id: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          project_id: string
          task_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_project_id_fkey"
            columns: ["task_id", "project_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id", "project_id"]
          },
        ]
      }
      water_events: {
        Row: {
          cooperative_id: string
          created_at: string
          event_date: string
          event_type: Database["public"]["Enums"]["water_event_type"]
          field_season_id: string
          id: string
          note: string | null
          water_depth_cm: number | null
        }
        Insert: {
          cooperative_id: string
          created_at?: string
          event_date: string
          event_type: Database["public"]["Enums"]["water_event_type"]
          field_season_id: string
          id?: string
          note?: string | null
          water_depth_cm?: number | null
        }
        Update: {
          cooperative_id?: string
          created_at?: string
          event_date?: string
          event_type?: Database["public"]["Enums"]["water_event_type"]
          field_season_id?: string
          id?: string
          note?: string | null
          water_depth_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "water_events_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "water_events_field_season_id_fkey"
            columns: ["field_season_id"]
            isOneToOne: false
            referencedRelation: "field_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      fields_view: {
        Row: {
          area_ha: number | null
          cooperative_id: string | null
          created_at: string | null
          declared_area_ha: number | null
          farmer_id: string | null
          farmer_name: string | null
          geojson: Json | null
          id: string | null
          name: string | null
          soil_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fields_cooperative_id_fkey"
            columns: ["cooperative_id"]
            isOneToOne: false
            referencedRelation: "cooperatives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fields_farmer_id_fkey"
            columns: ["farmer_id"]
            isOneToOne: false
            referencedRelation: "farmers"
            referencedColumns: ["id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      app_coop_id: { Args: never; Returns: string }
      app_is_admin: { Args: never; Returns: boolean }
      app_project_can_write: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      app_project_ids: { Args: never; Returns: string[] }
      app_project_role: { Args: { p_project_id: string }; Returns: string }
      app_project_support_active: {
        Args: { p_project_id: string }
        Returns: boolean
      }
      app_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      approve_project_stage: {
        Args: { p_ordinal: number; p_project_id: string }
        Returns: undefined
      }
      begin_project_support: {
        Args: {
          p_duration_minutes?: number
          p_project_id: string
          p_reason: string
        }
        Returns: {
          expires_at: string
          support_session_id: string
        }[]
      }
      build_credit_batch: { Args: { p_batch_id: string }; Returns: Json }
      check_field_overlap: {
        Args: { p_exclude_id?: string; p_geom: unknown }
        Returns: {
          field_id: string
          label: string
          overlap_ha: number
          same_cooperative: boolean
        }[]
      }
      create_cooperative_and_join: {
        Args: {
          p_code: string
          p_commune?: string
          p_contact_name?: string
          p_contact_phone?: string
          p_name: string
          p_province: string
          p_region: Database["public"]["Enums"]["vn_region"]
        }
        Returns: string
      }
      create_monitoring_period: {
        Args: {
          p_end_date: string
          p_name: string
          p_project_id: string
          p_start_date: string
          p_version?: number
        }
        Returns: string
      }
      create_mrv_report: {
        Args: {
          p_engine_version: string
          p_output_file_id?: string
          p_period_id: string
          p_requested_by: string
          p_results: Json
          p_status?: string
          p_template_id: string
          p_trace: Json
        }
        Returns: string
      }
      create_project: {
        Args: { p_description?: string; p_name: string }
        Returns: string
      }
      delete_monitoring_record: {
        Args: {
          p_expected_revision: number
          p_period_id: string
          p_record_key: string
        }
        Returns: number
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      gettransactionid: { Args: never; Returns: unknown }
      join_cooperative_by_code: { Args: { p_code: string }; Returns: string }
      lock_monitoring_period: {
        Args: { p_expected_revision: number; p_period_id: string }
        Returns: undefined
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      place_order: {
        Args: { p_batch_id: string; p_note?: string; p_quantity: number }
        Returns: string
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      project_json_hash: { Args: { p_value: Json }; Returns: string }
      project_lookup_invitee: {
        Args: { p_email: string; p_project_id: string }
        Returns: {
          already_member: boolean
          full_name: string
          user_id: string
        }[]
      }
      project_member_directory: {
        Args: { p_project_id: string }
        Returns: {
          email: string
          full_name: string
          role: string
          user_id: string
        }[]
      }
      project_stage_approval_directory: {
        Args: { p_project_id: string }
        Returns: {
          approved_at: string
          approved_by: string
          approver_name: string
          ordinal: number
          stage_id: string
        }[]
      }
      project_validate_expression: {
        Args: {
          p_baseline: string[]
          p_calcs: string[]
          p_depth?: number
          p_factors: string[]
          p_fields: string[]
          p_node: Json
        }
        Returns: undefined
      }
      project_validate_metric_schema: {
        Args: { p_schema: Json }
        Returns: undefined
      }
      project_validate_setup: { Args: { p_setup: Json }; Returns: undefined }
      project_validate_values: {
        Args: { p_schema: Json; p_scope: string; p_values: Json }
        Returns: undefined
      }
      save_field: {
        Args: {
          p_declared_area_ha?: number
          p_farmer_id: string
          p_field_id?: string
          p_geojson: Json
          p_name: string
          p_soil_type?: string
        }
        Returns: Json
      }
      save_monitoring_records: {
        Args: {
          p_expected_revision: number
          p_file_id?: string
          p_mapping?: Json
          p_period_id: string
          p_records: Json
        }
        Returns: Json
      }
      set_project_member: {
        Args: { p_project_id: string; p_role: string; p_user_id: string }
        Returns: undefined
      }
      settle_sandbox_payment: {
        Args: { p_order_id: string; p_succeed?: boolean }
        Returns: Json
      }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      unlock_field_season: {
        Args: { p_field_season_id: string }
        Returns: undefined
      }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      batch_status:
        | "draft"
        | "submitted"
        | "verified"
        | "listed"
        | "sold"
        | "retired"
      chat_role: "user" | "assistant"
      crop_type: "rice"
      order_status:
        | "pending"
        | "awaiting_payment"
        | "paid"
        | "cancelled"
        | "fulfilled"
      organic_amendment:
        | "straw_incorporated_short"
        | "straw_incorporated_long"
        | "compost"
        | "farmyard_manure"
        | "green_manure"
      payment_status: "pending" | "succeeded" | "failed" | "refunded"
      preseason_water: "non_flooded_short" | "non_flooded_long" | "flooded_pre"
      season_type: "early" | "mid" | "late"
      straw_method:
        | "incorporated_short"
        | "incorporated_long"
        | "removed"
        | "burned"
        | "mulched"
      user_role: "platform_admin" | "coop_manager" | "coop_staff" | "buyer"
      vn_region: "north" | "central" | "south"
      water_event_type: "drainage" | "reflood"
      water_regime:
        | "continuously_flooded"
        | "single_aeration"
        | "multiple_aeration"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      batch_status: [
        "draft",
        "submitted",
        "verified",
        "listed",
        "sold",
        "retired",
      ],
      chat_role: ["user", "assistant"],
      crop_type: ["rice"],
      order_status: [
        "pending",
        "awaiting_payment",
        "paid",
        "cancelled",
        "fulfilled",
      ],
      organic_amendment: [
        "straw_incorporated_short",
        "straw_incorporated_long",
        "compost",
        "farmyard_manure",
        "green_manure",
      ],
      payment_status: ["pending", "succeeded", "failed", "refunded"],
      preseason_water: ["non_flooded_short", "non_flooded_long", "flooded_pre"],
      season_type: ["early", "mid", "late"],
      straw_method: [
        "incorporated_short",
        "incorporated_long",
        "removed",
        "burned",
        "mulched",
      ],
      user_role: ["platform_admin", "coop_manager", "coop_staff", "buyer"],
      vn_region: ["north", "central", "south"],
      water_event_type: ["drainage", "reflood"],
      water_regime: [
        "continuously_flooded",
        "single_aeration",
        "multiple_aeration",
      ],
    },
  },
} as const
