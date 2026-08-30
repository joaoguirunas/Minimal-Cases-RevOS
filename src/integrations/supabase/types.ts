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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _app_config: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      _meta_debug: {
        Row: {
          created_at: string | null
          entry_count: number | null
          first_entry: Json | null
          id: number
          object: string | null
          raw_body: string | null
        }
        Insert: {
          created_at?: string | null
          entry_count?: number | null
          first_entry?: Json | null
          id?: number
          object?: string | null
          raw_body?: string | null
        }
        Update: {
          created_at?: string | null
          entry_count?: number | null
          first_entry?: Json | null
          id?: number
          object?: string | null
          raw_body?: string | null
        }
        Relationships: []
      }
      action_token_consumed: {
        Row: {
          action: string | null
          consumed_at: string
          jti: string
          meeting_id: string | null
          resource_id: string | null
          tenant_id: string | null
          token_exp: string | null
        }
        Insert: {
          action?: string | null
          consumed_at?: string
          jti: string
          meeting_id?: string | null
          resource_id?: string | null
          tenant_id?: string | null
          token_exp?: string | null
        }
        Update: {
          action?: string | null
          consumed_at?: string
          jti?: string
          meeting_id?: string | null
          resource_id?: string | null
          tenant_id?: string | null
          token_exp?: string | null
        }
        Relationships: []
      }
      adm_audit_log: {
        Row: {
          action: string
          actor_email: string
          actor_id: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: string | null
        }
        Insert: {
          action: string
          actor_email: string
          actor_id: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
        }
        Update: {
          action?: string
          actor_email?: string
          actor_id?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
        }
        Relationships: []
      }
      adm_clients: {
        Row: {
          anon_key: string
          app_version: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          custom_domain: string | null
          db_password: string | null
          db_password_hint: string | null
          db_version: string | null
          delete_requested_by: string | null
          deleted_at: string | null
          enabled_modules: Json | null
          id: string
          last_health_check_at: string | null
          last_health_status: string | null
          last_synced_at: string | null
          management_token: string | null
          management_token_hint: string | null
          management_token_rotated_at: string | null
          name: string
          notes: string | null
          service_role_key: string | null
          service_role_key_hint: string | null
          slug: string
          status: string
          supabase_url: string
          sync_status: string
          updated_at: string
        }
        Insert: {
          anon_key: string
          app_version?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          custom_domain?: string | null
          db_password?: string | null
          db_password_hint?: string | null
          db_version?: string | null
          delete_requested_by?: string | null
          deleted_at?: string | null
          enabled_modules?: Json | null
          id?: string
          last_health_check_at?: string | null
          last_health_status?: string | null
          last_synced_at?: string | null
          management_token?: string | null
          management_token_hint?: string | null
          management_token_rotated_at?: string | null
          name: string
          notes?: string | null
          service_role_key?: string | null
          service_role_key_hint?: string | null
          slug: string
          status?: string
          supabase_url: string
          sync_status?: string
          updated_at?: string
        }
        Update: {
          anon_key?: string
          app_version?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          custom_domain?: string | null
          db_password?: string | null
          db_password_hint?: string | null
          db_version?: string | null
          delete_requested_by?: string | null
          deleted_at?: string | null
          enabled_modules?: Json | null
          id?: string
          last_health_check_at?: string | null
          last_health_status?: string | null
          last_synced_at?: string | null
          management_token?: string | null
          management_token_hint?: string | null
          management_token_rotated_at?: string | null
          name?: string
          notes?: string | null
          service_role_key?: string | null
          service_role_key_hint?: string | null
          slug?: string
          status?: string
          supabase_url?: string
          sync_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      adm_migration_runs: {
        Row: {
          applied_at: string
          client_id: string
          error: string | null
          id: string
          migration_id: string
          status: string
        }
        Insert: {
          applied_at?: string
          client_id: string
          error?: string | null
          id?: string
          migration_id: string
          status?: string
        }
        Update: {
          applied_at?: string
          client_id?: string
          error?: string | null
          id?: string
          migration_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "adm_migration_runs_migration_id_fkey"
            columns: ["migration_id"]
            isOneToOne: false
            referencedRelation: "adm_migrations"
            referencedColumns: ["id"]
          },
        ]
      }
      adm_migrations: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          sql_content: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          sql_content: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          sql_content?: string
        }
        Relationships: []
      }
      adm_sync_jobs: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          started_at: string | null
          status: string
          triggered_by: string
          type: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          triggered_by?: string
          type?: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          started_at?: string | null
          status?: string
          triggered_by?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "adm_sync_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "adm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      adm_sync_logs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          level: string
          message: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          level?: string
          message: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          level?: string
          message?: string
        }
        Relationships: [
          {
            foreignKeyName: "adm_sync_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "adm_sync_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_callback_configs: {
        Row: {
          agent_id: string
          allow_agent_choose_mode: boolean
          allow_free_text: boolean
          cancel_on_resume: boolean
          created_at: string
          default_mode: string
          enabled: boolean
          free_prompt: string | null
          id: string
          max_delay_hours: number
          min_delay_minutes: number
          step_id: string | null
          templates: Json
          updated_at: string
          whatsapp_template_fallback: string | null
        }
        Insert: {
          agent_id: string
          allow_agent_choose_mode?: boolean
          allow_free_text?: boolean
          cancel_on_resume?: boolean
          created_at?: string
          default_mode?: string
          enabled?: boolean
          free_prompt?: string | null
          id?: string
          max_delay_hours?: number
          min_delay_minutes?: number
          step_id?: string | null
          templates?: Json
          updated_at?: string
          whatsapp_template_fallback?: string | null
        }
        Update: {
          agent_id?: string
          allow_agent_choose_mode?: boolean
          allow_free_text?: boolean
          cancel_on_resume?: boolean
          created_at?: string
          default_mode?: string
          enabled?: boolean
          free_prompt?: string | null
          id?: string
          max_delay_hours?: number
          min_delay_minutes?: number
          step_id?: string | null
          templates?: Json
          updated_at?: string
          whatsapp_template_fallback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_callback_configs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_callback_configs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          active: boolean | null
          agent_type: string | null
          buffer_ms: number
          channel_types: string[]
          created_at: string | null
          current_version: number | null
          description: string | null
          el_last_synced_at: string | null
          el_sync_status: string | null
          elevenlabs_agent_id: string | null
          enabled_tools: string[] | null
          general_rules: string | null
          humanizacao: string
          id: string
          identity: string | null
          input_data: string | null
          is_template: boolean | null
          leads_stages_id: string | null
          llm_max_tokens: number
          llm_model: string
          llm_provider: string
          llm_provider_id: string | null
          llm_temperature: number
          memory_window: number
          name: string
          origem_lista_filters: string[]
          pipeline_id: string | null
          pipeline_ids: string[] | null
          prompt_blocks: Json | null
          score_allow_empty: boolean
          score_matrix_ids: string[] | null
          score_value: number | null
          stage_ids: string[]
          template_type: string | null
          updated_at: string | null
          use_stages: boolean | null
          voice_enabled: boolean | null
          voice_first_message: string | null
          voice_id: string | null
          voice_language: string | null
          voice_model_id: string | null
          voice_response_mode: string
          voice_similarity: number | null
          voice_speed: number | null
          voice_stability: number | null
          wa_channel_id: string | null
          wa_phone_number_id: string | null
        }
        Insert: {
          active?: boolean | null
          agent_type?: string | null
          buffer_ms?: number
          channel_types?: string[]
          created_at?: string | null
          current_version?: number | null
          description?: string | null
          el_last_synced_at?: string | null
          el_sync_status?: string | null
          elevenlabs_agent_id?: string | null
          enabled_tools?: string[] | null
          general_rules?: string | null
          humanizacao?: string
          id?: string
          identity?: string | null
          input_data?: string | null
          is_template?: boolean | null
          leads_stages_id?: string | null
          llm_max_tokens?: number
          llm_model?: string
          llm_provider?: string
          llm_provider_id?: string | null
          llm_temperature?: number
          memory_window?: number
          name: string
          origem_lista_filters?: string[]
          pipeline_id?: string | null
          pipeline_ids?: string[] | null
          prompt_blocks?: Json | null
          score_allow_empty?: boolean
          score_matrix_ids?: string[] | null
          score_value?: number | null
          stage_ids?: string[]
          template_type?: string | null
          updated_at?: string | null
          use_stages?: boolean | null
          voice_enabled?: boolean | null
          voice_first_message?: string | null
          voice_id?: string | null
          voice_language?: string | null
          voice_model_id?: string | null
          voice_response_mode?: string
          voice_similarity?: number | null
          voice_speed?: number | null
          voice_stability?: number | null
          wa_channel_id?: string | null
          wa_phone_number_id?: string | null
        }
        Update: {
          active?: boolean | null
          agent_type?: string | null
          buffer_ms?: number
          channel_types?: string[]
          created_at?: string | null
          current_version?: number | null
          description?: string | null
          el_last_synced_at?: string | null
          el_sync_status?: string | null
          elevenlabs_agent_id?: string | null
          enabled_tools?: string[] | null
          general_rules?: string | null
          humanizacao?: string
          id?: string
          identity?: string | null
          input_data?: string | null
          is_template?: boolean | null
          leads_stages_id?: string | null
          llm_max_tokens?: number
          llm_model?: string
          llm_provider?: string
          llm_provider_id?: string | null
          llm_temperature?: number
          memory_window?: number
          name?: string
          origem_lista_filters?: string[]
          pipeline_id?: string | null
          pipeline_ids?: string[] | null
          prompt_blocks?: Json | null
          score_allow_empty?: boolean
          score_matrix_ids?: string[] | null
          score_value?: number | null
          stage_ids?: string[]
          template_type?: string | null
          updated_at?: string | null
          use_stages?: boolean | null
          voice_enabled?: boolean | null
          voice_first_message?: string | null
          voice_id?: string | null
          voice_language?: string | null
          voice_model_id?: string | null
          voice_response_mode?: string
          voice_similarity?: number | null
          voice_speed?: number | null
          voice_stability?: number | null
          wa_channel_id?: string | null
          wa_phone_number_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_elevenlabs_agent_id_fkey"
            columns: ["elevenlabs_agent_id"]
            isOneToOne: false
            referencedRelation: "elevenlabs_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_leads_stages_id_fkey"
            columns: ["leads_stages_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_llm_provider_id_fkey"
            columns: ["llm_provider_id"]
            isOneToOne: false
            referencedRelation: "settings_ai_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_wa_channel_id_fkey"
            columns: ["wa_channel_id"]
            isOneToOne: false
            referencedRelation: "settings_whatsapp_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents_execution_log: {
        Row: {
          ai_agent_id: string
          created_at: string | null
          created_by: string | null
          error_message: string | null
          execution_duration_ms: number | null
          execution_status: string
          id: string
          lead_id: string | null
          people_id: string
          prompt_rendered: string
          response_data: Json | null
          tools_used: string[] | null
        }
        Insert: {
          ai_agent_id: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          execution_duration_ms?: number | null
          execution_status: string
          id?: string
          lead_id?: string | null
          people_id: string
          prompt_rendered: string
          response_data?: Json | null
          tools_used?: string[] | null
        }
        Update: {
          ai_agent_id?: string
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          execution_duration_ms?: number | null
          execution_status?: string
          id?: string
          lead_id?: string | null
          people_id?: string
          prompt_rendered?: string
          response_data?: Json | null
          tools_used?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_execution_log_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_execution_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_execution_log_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents_history: {
        Row: {
          ai_agent_id: string | null
          changelog: Json | null
          created_at: string | null
          created_by: string | null
          data: Json
          id: string
          version: number
        }
        Insert: {
          ai_agent_id?: string | null
          changelog?: Json | null
          created_at?: string | null
          created_by?: string | null
          data: Json
          id?: string
          version: number
        }
        Update: {
          ai_agent_id?: string | null
          changelog?: Json | null
          created_at?: string | null
          created_by?: string | null
          data?: Json
          id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_history_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents_score_matrix: {
        Row: {
          active: boolean | null
          ai_agent_id: string | null
          created_at: string | null
          id: string
          score_matrix_id: string | null
        }
        Insert: {
          active?: boolean | null
          ai_agent_id?: string | null
          created_at?: string | null
          id?: string
          score_matrix_id?: string | null
        }
        Update: {
          active?: boolean | null
          ai_agent_id?: string | null
          created_at?: string | null
          id?: string
          score_matrix_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_score_matrix_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_score_matrix_score_matrix_id_fkey"
            columns: ["score_matrix_id"]
            isOneToOne: false
            referencedRelation: "score_matrix"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents_steps: {
        Row: {
          active: boolean | null
          ai_agent_id: string | null
          control: string | null
          created_at: string | null
          id: string
          name: string
          order_index: number
          prompt: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          ai_agent_id?: string | null
          control?: string | null
          created_at?: string | null
          id?: string
          name: string
          order_index: number
          prompt: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          ai_agent_id?: string | null
          control?: string | null
          created_at?: string | null
          id?: string
          name?: string
          order_index?: number
          prompt?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_steps_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents_steps_history: {
        Row: {
          error_message: string | null
          executed_at: string | null
          id: string
          lead_id: string | null
          result: Json | null
          step_id: string | null
          success: boolean | null
        }
        Insert: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          lead_id?: string | null
          result?: Json | null
          step_id?: string | null
          success?: boolean | null
        }
        Update: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          lead_id?: string | null
          result?: Json | null
          step_id?: string | null
          success?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_steps_history_leads_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_steps_history_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_scheduled_callbacks: {
        Row: {
          agent_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          channel: string
          created_at: string
          created_by_execution_id: string | null
          error_message: string | null
          fired_at: string | null
          id: string
          lead_id: string
          message_id: number | null
          message_text: string | null
          mode: string
          people_id: string
          reason: string
          response_data: Json | null
          retry_count: number
          scheduled_for: string
          status: string
          step_id: string | null
          template_id: string | null
          updated_at: string
          whatsapp_template_name: string | null
        }
        Insert: {
          agent_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel?: string
          created_at?: string
          created_by_execution_id?: string | null
          error_message?: string | null
          fired_at?: string | null
          id?: string
          lead_id: string
          message_id?: number | null
          message_text?: string | null
          mode: string
          people_id: string
          reason: string
          response_data?: Json | null
          retry_count?: number
          scheduled_for: string
          status?: string
          step_id?: string | null
          template_id?: string | null
          updated_at?: string
          whatsapp_template_name?: string | null
        }
        Update: {
          agent_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          channel?: string
          created_at?: string
          created_by_execution_id?: string | null
          error_message?: string | null
          fired_at?: string | null
          id?: string
          lead_id?: string
          message_id?: number | null
          message_text?: string | null
          mode?: string
          people_id?: string
          reason?: string
          response_data?: Json | null
          retry_count?: number
          scheduled_for?: string
          status?: string
          step_id?: string | null
          template_id?: string | null
          updated_at?: string
          whatsapp_template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_scheduled_callbacks_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_scheduled_callbacks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_scheduled_callbacks_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_scheduled_callbacks_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_scheduled_callbacks_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_events_log: {
        Row: {
          event_type: string
          id: string
          ip_hash: string | null
          metadata: Json | null
          occurred_at: string
          tenant_id: string | null
          user_agent_hash: string | null
          user_id: string | null
        }
        Insert: {
          event_type: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          occurred_at?: string
          tenant_id?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          occurred_at?: string
          tenant_id?: string | null
          user_agent_hash?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_events_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_login_attempts: {
        Row: {
          attempts: number
          blocked_until: string | null
          email_hash: string
          id: string
          ip_hash: string
          last_attempt: string
          tenant_id: string | null
        }
        Insert: {
          attempts?: number
          blocked_until?: string | null
          email_hash: string
          id?: string
          ip_hash: string
          last_attempt?: string
          tenant_id?: string | null
        }
        Update: {
          attempts?: number
          blocked_until?: string | null
          email_hash?: string
          id?: string
          ip_hash?: string
          last_attempt?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_login_attempts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_ad_accounts: {
        Row: {
          access_token: string | null
          account_id: string
          account_name: string | null
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          platform: string
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token?: string | null
          account_id: string
          account_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          platform: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string | null
          account_id?: string
          account_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          platform?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bi_ad_campaigns: {
        Row: {
          account_id: string
          ad_account_id: string | null
          campaign_id: string
          campaign_name: string | null
          clicks: number | null
          conversions: number | null
          date_end: string | null
          date_start: string | null
          id: string
          impressions: number | null
          objective: string | null
          platform: string | null
          revenue: number | null
          spend: number | null
          status: string | null
          synced_at: string
          utm_campaign: string | null
        }
        Insert: {
          account_id: string
          ad_account_id?: string | null
          campaign_id: string
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          date_end?: string | null
          date_start?: string | null
          id?: string
          impressions?: number | null
          objective?: string | null
          platform?: string | null
          revenue?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string
          utm_campaign?: string | null
        }
        Update: {
          account_id?: string
          ad_account_id?: string | null
          campaign_id?: string
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          date_end?: string | null
          date_start?: string | null
          id?: string
          impressions?: number | null
          objective?: string | null
          platform?: string | null
          revenue?: number | null
          spend?: number | null
          status?: string | null
          synced_at?: string
          utm_campaign?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bi_ad_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "bi_ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bi_ad_campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "bi_ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_ad_daily_stats: {
        Row: {
          campaign_id: string
          clicks: number | null
          conversions: number | null
          id: string
          impressions: number | null
          revenue: number | null
          spend: number | null
          stat_date: string
          synced_at: string
        }
        Insert: {
          campaign_id: string
          clicks?: number | null
          conversions?: number | null
          id?: string
          impressions?: number | null
          revenue?: number | null
          spend?: number | null
          stat_date: string
          synced_at?: string
        }
        Update: {
          campaign_id?: string
          clicks?: number | null
          conversions?: number | null
          id?: string
          impressions?: number | null
          revenue?: number | null
          spend?: number | null
          stat_date?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bi_ad_daily_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "bi_ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_ad_spend: {
        Row: {
          ad_account_id: string
          campaign_id: string | null
          clicks: number | null
          created_at: string
          currency: string
          date: string
          id: string
          impressions: number | null
          leads: number | null
          platform: string
          raw_data: Json | null
          source: string | null
          spend: number
        }
        Insert: {
          ad_account_id: string
          campaign_id?: string | null
          clicks?: number | null
          created_at?: string
          currency?: string
          date: string
          id?: string
          impressions?: number | null
          leads?: number | null
          platform: string
          raw_data?: Json | null
          source?: string | null
          spend?: number
        }
        Update: {
          ad_account_id?: string
          campaign_id?: string | null
          clicks?: number | null
          created_at?: string
          currency?: string
          date?: string
          id?: string
          impressions?: number | null
          leads?: number | null
          platform?: string
          raw_data?: Json | null
          source?: string | null
          spend?: number
        }
        Relationships: [
          {
            foreignKeyName: "bi_ad_spend_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "bi_ad_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_sdr_targets: {
        Row: {
          created_at: string
          daily_target: number
          id: string
          month: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          daily_target?: number
          id?: string
          month: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          daily_target?: number
          id?: string
          month?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "bi_sdr_targets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_settings: {
        Row: {
          google_developer_token: string | null
          id: string
          meta_app_id: string | null
          meta_app_secret: string | null
          meta_system_token: string | null
          meta_system_token_saved_at: string | null
          ms_client_id: string | null
          ms_client_secret: string | null
          singleton: boolean
          tiktok_access_token: string | null
          tiktok_ad_account_ids: string[] | null
          tiktok_app_id: string | null
          tiktok_app_secret: string | null
          tiktok_numeric_app_id: string | null
          tiktok_refresh_token: string | null
          tiktok_token_expires_at: string | null
          updated_at: string
          zoom_account_id: string | null
          zoom_client_id: string | null
          zoom_client_secret: string | null
        }
        Insert: {
          google_developer_token?: string | null
          id?: string
          meta_app_id?: string | null
          meta_app_secret?: string | null
          meta_system_token?: string | null
          meta_system_token_saved_at?: string | null
          ms_client_id?: string | null
          ms_client_secret?: string | null
          singleton?: boolean
          tiktok_access_token?: string | null
          tiktok_ad_account_ids?: string[] | null
          tiktok_app_id?: string | null
          tiktok_app_secret?: string | null
          tiktok_numeric_app_id?: string | null
          tiktok_refresh_token?: string | null
          tiktok_token_expires_at?: string | null
          updated_at?: string
          zoom_account_id?: string | null
          zoom_client_id?: string | null
          zoom_client_secret?: string | null
        }
        Update: {
          google_developer_token?: string | null
          id?: string
          meta_app_id?: string | null
          meta_app_secret?: string | null
          meta_system_token?: string | null
          meta_system_token_saved_at?: string | null
          ms_client_id?: string | null
          ms_client_secret?: string | null
          singleton?: boolean
          tiktok_access_token?: string | null
          tiktok_ad_account_ids?: string[] | null
          tiktok_app_id?: string | null
          tiktok_app_secret?: string | null
          tiktok_numeric_app_id?: string | null
          tiktok_refresh_token?: string | null
          tiktok_token_expires_at?: string | null
          updated_at?: string
          zoom_account_id?: string | null
          zoom_client_id?: string | null
          zoom_client_secret?: string | null
        }
        Relationships: []
      }
      bi_tiktok_ad_spend: {
        Row: {
          adgroup_id: string | null
          adgroup_name: string | null
          advertiser_id: string
          advertiser_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number | null
          conversions: number | null
          cpc: number | null
          cpm: number | null
          created_at: string | null
          ctr: number | null
          date: string
          id: string
          impressions: number | null
          spend: number | null
          spend_brl: number | null
          updated_at: string | null
        }
        Insert: {
          adgroup_id?: string | null
          adgroup_name?: string | null
          advertiser_id: string
          advertiser_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date: string
          id?: string
          impressions?: number | null
          spend?: number | null
          spend_brl?: number | null
          updated_at?: string | null
        }
        Update: {
          adgroup_id?: string | null
          adgroup_name?: string | null
          advertiser_id?: string
          advertiser_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversions?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string | null
          ctr?: number | null
          date?: string
          id?: string
          impressions?: number | null
          spend?: number | null
          spend_brl?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bi_voice_session_log: {
        Row: {
          duration_seconds: number | null
          ended_at: string | null
          error_msg: string | null
          id: string
          started_at: string
          tenant_id: string
          total_tokens_in: number | null
          total_tokens_out: number | null
          user_id: string | null
        }
        Insert: {
          duration_seconds?: number | null
          ended_at?: string | null
          error_msg?: string | null
          id?: string
          started_at?: string
          tenant_id: string
          total_tokens_in?: number | null
          total_tokens_out?: number | null
          user_id?: string | null
        }
        Update: {
          duration_seconds?: number | null
          ended_at?: string | null
          error_msg?: string | null
          id?: string
          started_at?: string
          tenant_id?: string
          total_tokens_in?: number | null
          total_tokens_out?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bi_voice_session_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_voice_token_log: {
        Row: {
          expires_at: string
          id: string
          issued_at: string
          model_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          expires_at: string
          id?: string
          issued_at?: string
          model_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          issued_at?: string
          model_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bi_voice_token_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings"
            referencedColumns: ["id"]
          },
        ]
      }
      bi_voice_tool_invocations: {
        Row: {
          args: Json | null
          called_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          success: boolean
          tenant_id: string | null
          tool_name: string
          user_id: string | null
        }
        Insert: {
          args?: Json | null
          called_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          success?: boolean
          tenant_id?: string | null
          tool_name: string
          user_id?: string | null
        }
        Update: {
          args?: Json | null
          called_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          success?: boolean
          tenant_id?: string | null
          tool_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bi_voice_tool_invocations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "settings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_rule_sets: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          updated_at: string
          url_id: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          updated_at?: string
          url_id?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          updated_at?: string
          url_id?: number | null
        }
        Relationships: []
      }
      booking_rules: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_active: boolean
          order_index: number
          rule_set_id: string
          rule_type: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          rule_set_id: string
          rule_type: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          order_index?: number
          rule_set_id?: string
          rule_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_rules_rule_set_id_fkey"
            columns: ["rule_set_id"]
            isOneToOne: false
            referencedRelation: "booking_rule_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_token_jti_usage: {
        Row: {
          jti: string
          reason: string | null
          revoked_at: string
        }
        Insert: {
          jti: string
          reason?: string | null
          revoked_at?: string
        }
        Update: {
          jti?: string
          reason?: string | null
          revoked_at?: string
        }
        Relationships: []
      }
      canned_responses: {
        Row: {
          channels: string[] | null
          content: string
          created_at: string | null
          id: string
          shortcut: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          channels?: string[] | null
          content: string
          created_at?: string | null
          id?: string
          shortcut?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          channels?: string[] | null
          content?: string
          created_at?: string | null
          id?: string
          shortcut?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clients_companies: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          id: string
          legal_name: string | null
          phone: string | null
          tax_id: string | null
          trade_name: string
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          phone?: string | null
          tax_id?: string | null
          trade_name: string
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          legal_name?: string | null
          phone?: string | null
          tax_id?: string | null
          trade_name?: string
          updated_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      clients_people: {
        Row: {
          accepts_calls: boolean | null
          active_channel_id: string | null
          address: string | null
          ai_enabled: boolean | null
          ai_last_message_at: string | null
          ai_paused_at: string | null
          ai_paused_reason: string | null
          ai_processing_lock: boolean
          ai_processing_lock_at: string | null
          archived: boolean | null
          archived_at: string | null
          business_category: string | null
          company_description: string | null
          conversation_summary: string | null
          created_at: string | null
          created_by: string | null
          disc_profile: string | null
          disc_summary: string | null
          document: string | null
          email: string | null
          enrichment_layers: string[] | null
          facebook_url: string | null
          first_unread_at: string | null
          goal: string | null
          google_maps_url: string | null
          google_place_id: string | null
          google_rating: number | null
          google_review_count: number | null
          id: string
          identity_collection_opted_out: boolean | null
          income: string | null
          instagram_business_id: string | null
          instagram_followers: number | null
          instagram_handle: string | null
          instagram_id: string | null
          instagram_user_id: string | null
          instagram_verified: boolean | null
          kiwify_customer_id: string | null
          last_read_at: string | null
          last_read_by: string | null
          linkedin_url: string | null
          manychat_subscriber_id: number | null
          merge_history: Json
          merged_into_id: string | null
          moment: string | null
          name: string
          notes: string | null
          profile_picture: string | null
          q1_main_bottleneck: string | null
          q10_stakeholders: string | null
          q11_budget_approved: string | null
          q12_timeline: string | null
          q13_urgency_reason: string | null
          q14_data_ready: string | null
          q15_minimum_volume: string | null
          q16_expected_roi: string | null
          q17_objections: string | null
          q18_real_fit: string | null
          q19_qualification_status: string | null
          q2_lead_volume_month: string | null
          q20_rejection_reason: string | null
          q21_interest_level: string | null
          q22_close_probability: string | null
          q23_behavioral_tags: string | null
          q24_last_update_by_agent: string | null
          q25_disc_profile: string | null
          q26_disc_analysis: string | null
          q3_team_size: string | null
          q4_crm_maturity: string | null
          q5_crm_name: string | null
          q6_trigger: string | null
          q7_problem_impact: string | null
          q8_engagement_level: string | null
          q9_decision_authority: string | null
          score: number | null
          score_matrix_id: string | null
          service_status: string | null
          source: string | null
          status: string | null
          telefone: string | null
          tiktok_open_id: string | null
          tiktok_username: string | null
          type: string | null
          unread_count: number
          updated_at: string | null
          website: string | null
          whatsapp: string | null
          whatsapp_optin: boolean
          youtube_url: string | null
        }
        Insert: {
          accepts_calls?: boolean | null
          active_channel_id?: string | null
          address?: string | null
          ai_enabled?: boolean | null
          ai_last_message_at?: string | null
          ai_paused_at?: string | null
          ai_paused_reason?: string | null
          ai_processing_lock?: boolean
          ai_processing_lock_at?: string | null
          archived?: boolean | null
          archived_at?: string | null
          business_category?: string | null
          company_description?: string | null
          conversation_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          disc_profile?: string | null
          disc_summary?: string | null
          document?: string | null
          email?: string | null
          enrichment_layers?: string[] | null
          facebook_url?: string | null
          first_unread_at?: string | null
          goal?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          identity_collection_opted_out?: boolean | null
          income?: string | null
          instagram_business_id?: string | null
          instagram_followers?: number | null
          instagram_handle?: string | null
          instagram_id?: string | null
          instagram_user_id?: string | null
          instagram_verified?: boolean | null
          kiwify_customer_id?: string | null
          last_read_at?: string | null
          last_read_by?: string | null
          linkedin_url?: string | null
          manychat_subscriber_id?: number | null
          merge_history?: Json
          merged_into_id?: string | null
          moment?: string | null
          name: string
          notes?: string | null
          profile_picture?: string | null
          q1_main_bottleneck?: string | null
          q10_stakeholders?: string | null
          q11_budget_approved?: string | null
          q12_timeline?: string | null
          q13_urgency_reason?: string | null
          q14_data_ready?: string | null
          q15_minimum_volume?: string | null
          q16_expected_roi?: string | null
          q17_objections?: string | null
          q18_real_fit?: string | null
          q19_qualification_status?: string | null
          q2_lead_volume_month?: string | null
          q20_rejection_reason?: string | null
          q21_interest_level?: string | null
          q22_close_probability?: string | null
          q23_behavioral_tags?: string | null
          q24_last_update_by_agent?: string | null
          q25_disc_profile?: string | null
          q26_disc_analysis?: string | null
          q3_team_size?: string | null
          q4_crm_maturity?: string | null
          q5_crm_name?: string | null
          q6_trigger?: string | null
          q7_problem_impact?: string | null
          q8_engagement_level?: string | null
          q9_decision_authority?: string | null
          score?: number | null
          score_matrix_id?: string | null
          service_status?: string | null
          source?: string | null
          status?: string | null
          telefone?: string | null
          tiktok_open_id?: string | null
          tiktok_username?: string | null
          type?: string | null
          unread_count?: number
          updated_at?: string | null
          website?: string | null
          whatsapp?: string | null
          whatsapp_optin?: boolean
          youtube_url?: string | null
        }
        Update: {
          accepts_calls?: boolean | null
          active_channel_id?: string | null
          address?: string | null
          ai_enabled?: boolean | null
          ai_last_message_at?: string | null
          ai_paused_at?: string | null
          ai_paused_reason?: string | null
          ai_processing_lock?: boolean
          ai_processing_lock_at?: string | null
          archived?: boolean | null
          archived_at?: string | null
          business_category?: string | null
          company_description?: string | null
          conversation_summary?: string | null
          created_at?: string | null
          created_by?: string | null
          disc_profile?: string | null
          disc_summary?: string | null
          document?: string | null
          email?: string | null
          enrichment_layers?: string[] | null
          facebook_url?: string | null
          first_unread_at?: string | null
          goal?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          google_rating?: number | null
          google_review_count?: number | null
          id?: string
          identity_collection_opted_out?: boolean | null
          income?: string | null
          instagram_business_id?: string | null
          instagram_followers?: number | null
          instagram_handle?: string | null
          instagram_id?: string | null
          instagram_user_id?: string | null
          instagram_verified?: boolean | null
          kiwify_customer_id?: string | null
          last_read_at?: string | null
          last_read_by?: string | null
          linkedin_url?: string | null
          manychat_subscriber_id?: number | null
          merge_history?: Json
          merged_into_id?: string | null
          moment?: string | null
          name?: string
          notes?: string | null
          profile_picture?: string | null
          q1_main_bottleneck?: string | null
          q10_stakeholders?: string | null
          q11_budget_approved?: string | null
          q12_timeline?: string | null
          q13_urgency_reason?: string | null
          q14_data_ready?: string | null
          q15_minimum_volume?: string | null
          q16_expected_roi?: string | null
          q17_objections?: string | null
          q18_real_fit?: string | null
          q19_qualification_status?: string | null
          q2_lead_volume_month?: string | null
          q20_rejection_reason?: string | null
          q21_interest_level?: string | null
          q22_close_probability?: string | null
          q23_behavioral_tags?: string | null
          q24_last_update_by_agent?: string | null
          q25_disc_profile?: string | null
          q26_disc_analysis?: string | null
          q3_team_size?: string | null
          q4_crm_maturity?: string | null
          q5_crm_name?: string | null
          q6_trigger?: string | null
          q7_problem_impact?: string | null
          q8_engagement_level?: string | null
          q9_decision_authority?: string | null
          score?: number | null
          score_matrix_id?: string | null
          service_status?: string | null
          source?: string | null
          status?: string | null
          telefone?: string | null
          tiktok_open_id?: string | null
          tiktok_username?: string | null
          type?: string | null
          unread_count?: number
          updated_at?: string | null
          website?: string | null
          whatsapp?: string | null
          whatsapp_optin?: boolean
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_people_active_channel_id_fkey"
            columns: ["active_channel_id"]
            isOneToOne: false
            referencedRelation: "settings_whatsapp_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_people_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_people_last_read_by_fkey"
            columns: ["last_read_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_people_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_score_matrix"
            columns: ["score_matrix_id"]
            isOneToOne: false
            referencedRelation: "score_matrix"
            referencedColumns: ["id"]
          },
        ]
      }
      clients_people_companies: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          people_id: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          people_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          people_id?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_people_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "clients_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_people_companies_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
        ]
      }
      clients_people_updates: {
        Row: {
          created_at: string | null
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          people_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          people_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          people_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_people_updates_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_people_updates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_event_rules: {
        Row: {
          active: boolean
          created_at: string
          google_account_id: string | null
          google_conversion_action_id: string | null
          google_conversion_action_name: string | null
          google_currency: string
          google_enabled: boolean
          google_send_value: boolean
          id: string
          meta_enabled: boolean
          meta_event_name: string | null
          meta_pixel_id: string | null
          meta_send_value: boolean
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          google_account_id?: string | null
          google_conversion_action_id?: string | null
          google_conversion_action_name?: string | null
          google_currency?: string
          google_enabled?: boolean
          google_send_value?: boolean
          id?: string
          meta_enabled?: boolean
          meta_event_name?: string | null
          meta_pixel_id?: string | null
          meta_send_value?: boolean
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          google_account_id?: string | null
          google_conversion_action_id?: string | null
          google_conversion_action_name?: string | null
          google_currency?: string
          google_enabled?: boolean
          google_send_value?: boolean
          id?: string
          meta_enabled?: boolean
          meta_event_name?: string | null
          meta_pixel_id?: string | null
          meta_send_value?: boolean
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversion_events_queue: {
        Row: {
          created_at: string
          event_data: Json
          google_response: Json | null
          google_sent_at: string | null
          google_status: string
          id: string
          lead_id: string
          lead_source: string | null
          meta_response: Json | null
          meta_sent_at: string | null
          meta_status: string
          retry_count: number
          skip_reason: string | null
          stage_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json
          google_response?: Json | null
          google_sent_at?: string | null
          google_status?: string
          id?: string
          lead_id: string
          lead_source?: string | null
          meta_response?: Json | null
          meta_sent_at?: string | null
          meta_status?: string
          retry_count?: number
          skip_reason?: string | null
          stage_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json
          google_response?: Json | null
          google_sent_at?: string | null
          google_status?: string
          id?: string
          lead_id?: string
          lead_source?: string | null
          meta_response?: Json | null
          meta_sent_at?: string | null
          meta_status?: string
          retry_count?: number
          skip_reason?: string | null
          stage_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_events_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_queue_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_platform_credentials: {
        Row: {
          created_at: string
          credentials: Json
          id: string
          is_active: boolean
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          id?: string
          is_active?: boolean
          platform: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          id?: string
          is_active?: boolean
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversion_stage_mappings: {
        Row: {
          created_at: string
          google_conversion_action: string | null
          google_currency: string
          google_enabled: boolean
          google_send_value: boolean
          id: string
          meta_enabled: boolean
          meta_event_name: string | null
          meta_send_value: boolean
          pipeline_id: string
          stage_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          google_conversion_action?: string | null
          google_currency?: string
          google_enabled?: boolean
          google_send_value?: boolean
          id?: string
          meta_enabled?: boolean
          meta_event_name?: string | null
          meta_send_value?: boolean
          pipeline_id: string
          stage_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          google_conversion_action?: string | null
          google_currency?: string
          google_enabled?: boolean
          google_send_value?: boolean
          id?: string
          meta_enabled?: boolean
          meta_event_name?: string | null
          meta_send_value?: boolean
          pipeline_id?: string
          stage_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_stage_mappings_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_stage_mappings_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tenants: {
        Row: {
          ativo: boolean
          created_at: string
          disc_config: Json | null
          id: string
          logo_url: string | null
          modulos_ativos: Json | null
          name: string
          primary_color: string | null
          resumo_config: Json | null
          secondary_color: string | null
          tenant_slug: string | null
          value: string
          webhook_conversas: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          disc_config?: Json | null
          id?: string
          logo_url?: string | null
          modulos_ativos?: Json | null
          name: string
          primary_color?: string | null
          resumo_config?: Json | null
          secondary_color?: string | null
          tenant_slug?: string | null
          value: string
          webhook_conversas?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          disc_config?: Json | null
          id?: string
          logo_url?: string | null
          modulos_ativos?: Json | null
          name?: string
          primary_color?: string | null
          resumo_config?: Json | null
          secondary_color?: string | null
          tenant_slug?: string | null
          value?: string
          webhook_conversas?: string | null
        }
        Relationships: []
      }
      data_deletion_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          processed_at: string | null
          protocol: string
          reason: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          processed_at?: string | null
          protocol?: string
          reason?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          processed_at?: string | null
          protocol?: string
          reason?: string | null
          status?: string
        }
        Relationships: []
      }
      data_export_jobs: {
        Row: {
          created_at: string
          download_url: string | null
          error_message: string | null
          expires_at: string | null
          id: string
          requested_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          requested_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          id?: string
          requested_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_export_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      elevenlabs_agents: {
        Row: {
          ai_agent_id: string | null
          created_at: string
          elevenlabs_agent_id: string
          first_message: string | null
          id: string
          llm_model: string | null
          llm_provider: string | null
          name: string | null
          phone_number: string | null
          phone_number_id: string | null
          status: string | null
          synced_at: string | null
          updated_at: string
          voice_id: string | null
        }
        Insert: {
          ai_agent_id?: string | null
          created_at?: string
          elevenlabs_agent_id: string
          first_message?: string | null
          id?: string
          llm_model?: string | null
          llm_provider?: string | null
          name?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string
          voice_id?: string | null
        }
        Update: {
          ai_agent_id?: string | null
          created_at?: string
          elevenlabs_agent_id?: string
          first_message?: string | null
          id?: string
          llm_model?: string | null
          llm_provider?: string | null
          name?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          status?: string | null
          synced_at?: string | null
          updated_at?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "elevenlabs_agents_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      elevenlabs_voices: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          gender: string | null
          id: string
          is_default: boolean | null
          labels: Json | null
          language: string | null
          name: string
          preview_url: string | null
          similarity_boost: number | null
          source: string | null
          speed: number | null
          stability: number | null
          style: number | null
          synced_at: string | null
          updated_at: string
          use_case: string | null
          voice_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_default?: boolean | null
          labels?: Json | null
          language?: string | null
          name: string
          preview_url?: string | null
          similarity_boost?: number | null
          source?: string | null
          speed?: number | null
          stability?: number | null
          style?: number | null
          synced_at?: string | null
          updated_at?: string
          use_case?: string | null
          voice_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          gender?: string | null
          id?: string
          is_default?: boolean | null
          labels?: Json | null
          language?: string | null
          name?: string
          preview_url?: string | null
          similarity_boost?: number | null
          source?: string | null
          speed?: number | null
          stability?: number | null
          style?: number | null
          synced_at?: string | null
          updated_at?: string
          use_case?: string | null
          voice_id?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          html_body: string
          id: string
          name: string
          subject: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          html_body: string
          id?: string
          name: string
          subject: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          html_body?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: []
      }
      followup_queue: {
        Row: {
          channel: string
          created_at: string
          error_message: string | null
          fired_at: string | null
          followup_id: string | null
          held_for_bh: boolean
          id: string
          lead_id: string
          meeting_followup_id: string | null
          message: string | null
          message_id: number | null
          original_scheduled_for: string | null
          person_id: string | null
          phone_number: string | null
          response_data: Json | null
          retry_count: number
          scheduled_for: string
          source_type: string
          status: string
          subject: string | null
          template_id: string | null
          updated_at: string
        }
        Insert: {
          channel: string
          created_at?: string
          error_message?: string | null
          fired_at?: string | null
          followup_id?: string | null
          held_for_bh?: boolean
          id?: string
          lead_id: string
          meeting_followup_id?: string | null
          message?: string | null
          message_id?: number | null
          original_scheduled_for?: string | null
          person_id?: string | null
          phone_number?: string | null
          response_data?: Json | null
          retry_count?: number
          scheduled_for: string
          source_type?: string
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          error_message?: string | null
          fired_at?: string | null
          followup_id?: string | null
          held_for_bh?: boolean
          id?: string
          lead_id?: string
          meeting_followup_id?: string | null
          message?: string | null
          message_id?: number | null
          original_scheduled_for?: string | null
          person_id?: string | null
          phone_number?: string | null
          response_data?: Json | null
          retry_count?: number
          scheduled_for?: string
          source_type?: string
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_queue_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "leads_stages_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_queue_meeting_followup_id_fkey"
            columns: ["meeting_followup_id"]
            isOneToOne: false
            referencedRelation: "meetings_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_queue_pessoa_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
        ]
      }
      form_pro_forms: {
        Row: {
          create_contact: boolean
          create_lead: boolean
          created_at: string
          fields: Json
          id: string
          name: string
          pipeline_id: string | null
          settings: Json
          updated_at: string
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          create_contact?: boolean
          create_lead?: boolean
          created_at?: string
          fields?: Json
          id?: string
          name: string
          pipeline_id?: string | null
          settings?: Json
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          create_contact?: boolean
          create_lead?: boolean
          created_at?: string
          fields?: Json
          id?: string
          name?: string
          pipeline_id?: string | null
          settings?: Json
          updated_at?: string
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lp_forms_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      form_pro_rate_limits: {
        Row: {
          id: string
          ip: string
          ts: string
        }
        Insert: {
          id?: string
          ip: string
          ts?: string
        }
        Update: {
          id?: string
          ip?: string
          ts?: string
        }
        Relationships: []
      }
      form_pro_submissions: {
        Row: {
          data: Json
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          form_id: string | null
          gclid: string | null
          id: string
          ip_address: unknown
          lead_id: string | null
          meta_adgroup_id: string | null
          meta_form_id: string | null
          meta_leadgen_id: string | null
          page_id: string | null
          people_id: string | null
          source: string
          submitted_at: string
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          data?: Json
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          form_id?: string | null
          gclid?: string | null
          id?: string
          ip_address?: unknown
          lead_id?: string | null
          meta_adgroup_id?: string | null
          meta_form_id?: string | null
          meta_leadgen_id?: string | null
          page_id?: string | null
          people_id?: string | null
          source?: string
          submitted_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          data?: Json
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          form_id?: string | null
          gclid?: string | null
          id?: string
          ip_address?: unknown
          lead_id?: string | null
          meta_adgroup_id?: string | null
          meta_form_id?: string | null
          meta_leadgen_id?: string | null
          page_id?: string | null
          people_id?: string | null
          source?: string
          submitted_at?: string
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_pro_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "form_pro_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_pro_submissions_meta_form_id_fkey"
            columns: ["meta_form_id"]
            isOneToOne: false
            referencedRelation: "meta_lead_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_submissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lp_submissions_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_webhooks: {
        Row: {
          active: boolean
          create_mode: string
          created_at: string
          field_mapping: Json
          id: string
          name: string
          pipeline_id: string | null
          stage_id: string | null
          token: string
          trigger_config: Json | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          create_mode?: string
          created_at?: string
          field_mapping?: Json
          id?: string
          name: string
          pipeline_id?: string | null
          stage_id?: string | null
          token?: string
          trigger_config?: Json | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          create_mode?: string
          created_at?: string
          field_mapping?: Json
          id?: string
          name?: string
          pipeline_id?: string | null
          stage_id?: string | null
          token?: string
          trigger_config?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_webhooks_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_webhooks_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_automation_log: {
        Row: {
          action_executed: string | null
          automation_id: string | null
          automation_name: string | null
          error_message: string | null
          executed_at: string
          filters_matched: Json | null
          id: string
          ig_message_id: string | null
          message_text: string | null
          person_id: string | null
          person_name: string | null
          status: string
          trigger_type: string | null
        }
        Insert: {
          action_executed?: string | null
          automation_id?: string | null
          automation_name?: string | null
          error_message?: string | null
          executed_at?: string
          filters_matched?: Json | null
          id?: string
          ig_message_id?: string | null
          message_text?: string | null
          person_id?: string | null
          person_name?: string | null
          status?: string
          trigger_type?: string | null
        }
        Update: {
          action_executed?: string | null
          automation_id?: string | null
          automation_name?: string | null
          error_message?: string | null
          executed_at?: string
          filters_matched?: Json | null
          id?: string
          ig_message_id?: string | null
          message_text?: string | null
          person_id?: string | null
          person_name?: string | null
          status?: string
          trigger_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instagram_automation_log_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "instagram_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instagram_automation_log_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
        ]
      }
      instagram_automations: {
        Row: {
          action_comment_text: string | null
          action_comment_texts: Json
          action_dm_quick_replies: Json
          action_dm_text: string | null
          action_type: string
          cooldown_hours: number
          created_at: string
          description: string | null
          filter_operator: string
          filters: Json
          id: string
          is_active: boolean
          name: string
          priority: number
          target_post_id: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_comment_text?: string | null
          action_comment_texts?: Json
          action_dm_quick_replies?: Json
          action_dm_text?: string | null
          action_type: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          filter_operator?: string
          filters?: Json
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          target_post_id?: string | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_comment_text?: string | null
          action_comment_texts?: Json
          action_dm_quick_replies?: Json
          action_dm_text?: string | null
          action_type?: string
          cooldown_hours?: number
          created_at?: string
          description?: string | null
          filter_operator?: string
          filters?: Json
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          target_post_id?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      kiwify_connections: {
        Row: {
          access_token_enc: string | null
          account_id: string
          client_id: string
          client_secret_enc: string
          created_at: string
          enforce_signature: boolean
          id: string
          last_error: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
          webhook_id: string | null
          webhook_token_enc: string | null
        }
        Insert: {
          access_token_enc?: string | null
          account_id: string
          client_id: string
          client_secret_enc: string
          created_at?: string
          enforce_signature?: boolean
          id?: string
          last_error?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          webhook_id?: string | null
          webhook_token_enc?: string | null
        }
        Update: {
          access_token_enc?: string | null
          account_id?: string
          client_id?: string
          client_secret_enc?: string
          created_at?: string
          enforce_signature?: boolean
          id?: string
          last_error?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          webhook_id?: string | null
          webhook_token_enc?: string | null
        }
        Relationships: []
      }
      kiwify_event_mappings: {
        Row: {
          active: boolean
          created_at: string
          id: string
          product_id: string | null
          tags_to_add: string[]
          tags_to_remove: string[]
          target_pipeline_id: string
          target_stage_id: string
          trigger: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          product_id?: string | null
          tags_to_add?: string[]
          tags_to_remove?: string[]
          target_pipeline_id: string
          target_stage_id: string
          trigger: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          product_id?: string | null
          tags_to_add?: string[]
          tags_to_remove?: string[]
          target_pipeline_id?: string
          target_stage_id?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiwify_event_mappings_target_pipeline_id_fkey"
            columns: ["target_pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiwify_event_mappings_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      kiwify_lead_products: {
        Row: {
          connection_id: string | null
          created_at: string
          first_seen_at: string
          id: string
          last_seen_at: string
          people_id: string
          product_id: string
          product_name: string
          updated_at: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          people_id: string
          product_id: string
          product_name: string
          updated_at?: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          people_id?: string
          product_id?: string
          product_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiwify_lead_products_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "kiwify_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiwify_lead_products_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
        ]
      }
      kiwify_message_automations: {
        Row: {
          active: boolean
          cancel_on_triggers: string[]
          created_at: string
          id: string
          product_id: string | null
          steps: Json
          trigger: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cancel_on_triggers?: string[]
          created_at?: string
          id?: string
          product_id?: string | null
          steps: Json
          trigger: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cancel_on_triggers?: string[]
          created_at?: string
          id?: string
          product_id?: string | null
          steps?: Json
          trigger?: string
          updated_at?: string
        }
        Relationships: []
      }
      kiwify_message_jobs: {
        Row: {
          automation_id: string | null
          cancel_on_triggers: string[]
          created_at: string
          error_message: string | null
          event_id: string | null
          fired_at: string | null
          id: string
          lead_id: string | null
          message_id: number | null
          order_id: string | null
          people_id: string | null
          retry_count: number
          scheduled_for: string
          status: string
          step_index: number
          template_id: string | null
          trigger: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          automation_id?: string | null
          cancel_on_triggers?: string[]
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          fired_at?: string | null
          id?: string
          lead_id?: string | null
          message_id?: number | null
          order_id?: string | null
          people_id?: string | null
          retry_count?: number
          scheduled_for: string
          status?: string
          step_index: number
          template_id?: string | null
          trigger: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          automation_id?: string | null
          cancel_on_triggers?: string[]
          created_at?: string
          error_message?: string | null
          event_id?: string | null
          fired_at?: string | null
          id?: string
          lead_id?: string | null
          message_id?: number | null
          order_id?: string | null
          people_id?: string | null
          retry_count?: number
          scheduled_for?: string
          status?: string
          step_index?: number
          template_id?: string | null
          trigger?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "kiwify_message_jobs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "kiwify_message_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiwify_message_jobs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "kiwify_webhook_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiwify_message_jobs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiwify_message_jobs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kiwify_message_jobs_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
        ]
      }
      kiwify_webhook_events: {
        Row: {
          connection_id: string
          created_at: string
          dedup_key: string
          error: string | null
          event_type: string
          id: string
          order_id: string | null
          processed_at: string | null
          raw_payload: Json
          signature_valid: boolean
          status: string
          subscription_id: string | null
          trigger: string | null
        }
        Insert: {
          connection_id: string
          created_at?: string
          dedup_key: string
          error?: string | null
          event_type: string
          id?: string
          order_id?: string | null
          processed_at?: string | null
          raw_payload: Json
          signature_valid?: boolean
          status?: string
          subscription_id?: string | null
          trigger?: string | null
        }
        Update: {
          connection_id?: string
          created_at?: string
          dedup_key?: string
          error?: string | null
          event_type?: string
          id?: string
          order_id?: string | null
          processed_at?: string | null
          raw_payload?: Json
          signature_valid?: boolean
          status?: string
          subscription_id?: string | null
          trigger?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kiwify_webhook_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "kiwify_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_field_definitions: {
        Row: {
          active: boolean
          agent_managed: boolean
          category: string
          created_at: string
          entity_type: string
          id: string
          key: string
          name: string
          options: Json
          order_index: number
          pipeline_id: string | null
          required: boolean
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          agent_managed?: boolean
          category: string
          created_at?: string
          entity_type?: string
          id?: string
          key: string
          name: string
          options?: Json
          order_index?: number
          pipeline_id?: string | null
          required?: boolean
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          agent_managed?: boolean
          category?: string
          created_at?: string
          entity_type?: string
          id?: string
          key?: string
          name?: string
          options?: Json
          order_index?: number
          pipeline_id?: string | null
          required?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_field_definitions_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_field_values: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          field_definition_id: string
          id: string
          lead_id: string | null
          updated_at: string
          value_boolean: boolean | null
          value_date: string | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type?: string
          field_definition_id: string
          id?: string
          lead_id?: string | null
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          field_definition_id?: string
          id?: string
          lead_id?: string | null
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_field_values_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "lead_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_field_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tags: {
        Row: {
          active: boolean
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_types: {
        Row: {
          created_at: string
          csv_example: string[]
          csv_headers: string[]
          description: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          whatsapp_template_id: string | null
        }
        Insert: {
          created_at?: string
          csv_example?: string[]
          csv_headers?: string[]
          description?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          whatsapp_template_id?: string | null
        }
        Update: {
          created_at?: string
          csv_example?: string[]
          csv_headers?: string[]
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_types_whatsapp_template_id_fkey"
            columns: ["whatsapp_template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived: boolean | null
          archived_at: string | null
          close_probability: number | null
          company_id: string | null
          control: string | null
          created_at: string | null
          description: string | null
          fb_lead_id: string | null
          fbc: string | null
          fbclid: string | null
          fbp: string | null
          first_inbound_at: string | null
          gclid: string | null
          id: string
          last_interaction_at: string | null
          lead_source: string | null
          leads_loss_reasons_id: string | null
          leads_pipelines_id: string | null
          leads_stages_id: string | null
          lifecycle_stage: string | null
          loss_reason: string | null
          lost_at: string | null
          nome_evento: string | null
          origem_lista: string | null
          people_id: string | null
          pre_sale_temperature: number | null
          recomendante: string | null
          relacao_corretor: string | null
          relacao_recomendante: string | null
          status: string
          teams_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          value: number | null
          won_at: string | null
        }
        Insert: {
          archived?: boolean | null
          archived_at?: string | null
          close_probability?: number | null
          company_id?: string | null
          control?: string | null
          created_at?: string | null
          description?: string | null
          fb_lead_id?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          first_inbound_at?: string | null
          gclid?: string | null
          id?: string
          last_interaction_at?: string | null
          lead_source?: string | null
          leads_loss_reasons_id?: string | null
          leads_pipelines_id?: string | null
          leads_stages_id?: string | null
          lifecycle_stage?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          nome_evento?: string | null
          origem_lista?: string | null
          people_id?: string | null
          pre_sale_temperature?: number | null
          recomendante?: string | null
          relacao_corretor?: string | null
          relacao_recomendante?: string | null
          status?: string
          teams_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          won_at?: string | null
        }
        Update: {
          archived?: boolean | null
          archived_at?: string | null
          close_probability?: number | null
          company_id?: string | null
          control?: string | null
          created_at?: string | null
          description?: string | null
          fb_lead_id?: string | null
          fbc?: string | null
          fbclid?: string | null
          fbp?: string | null
          first_inbound_at?: string | null
          gclid?: string | null
          id?: string
          last_interaction_at?: string | null
          lead_source?: string | null
          leads_loss_reasons_id?: string | null
          leads_pipelines_id?: string | null
          leads_stages_id?: string | null
          lifecycle_stage?: string | null
          loss_reason?: string | null
          lost_at?: string | null
          nome_evento?: string | null
          origem_lista?: string | null
          people_id?: string | null
          pre_sale_temperature?: number | null
          recomendante?: string | null
          relacao_corretor?: string | null
          relacao_recomendante?: string | null
          status?: string
          teams_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          value?: number | null
          won_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_companies_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "clients_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_leads_loss_reasons_id_fkey"
            columns: ["leads_loss_reasons_id"]
            isOneToOne: false
            referencedRelation: "leads_loss_reasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_leads_pipelines_id_fkey"
            columns: ["leads_pipelines_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_leads_stages_id_fkey"
            columns: ["leads_stages_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_teams_id_fkey"
            columns: ["teams_id"]
            isOneToOne: false
            referencedRelation: "settings_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_users_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_files: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          lead_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          lead_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          lead_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_files_leads_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_files_users_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_loss_reasons: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      leads_notes: {
        Row: {
          content: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_notes_leads_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_notes_users_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_pipelines: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          kiwify_product_id: string | null
          kiwify_product_name: string | null
          name: string
          order_index: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          kiwify_product_id?: string | null
          kiwify_product_name?: string | null
          name: string
          order_index?: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          kiwify_product_id?: string | null
          kiwify_product_name?: string | null
          name?: string
          order_index?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      leads_stage_duplication_rules: {
        Row: {
          active: boolean
          created_at: string
          id: string
          source_stage_id: string
          target_pipeline_id: string
          target_stage_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          source_stage_id: string
          target_pipeline_id: string
          target_stage_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          source_stage_id?: string
          target_pipeline_id?: string
          target_stage_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_stage_duplication_rules_source_stage_id_fkey"
            columns: ["source_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_duplication_rules_target_pipeline_id_fkey"
            columns: ["target_pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stage_duplication_rules_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_stages: {
        Row: {
          active: boolean | null
          ai_priority: boolean
          color: string | null
          created_at: string | null
          id: string
          leads_pipelines_id: string | null
          name: string
          order_index: number
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          ai_priority?: boolean
          color?: string | null
          created_at?: string | null
          id?: string
          leads_pipelines_id?: string | null
          name: string
          order_index?: number
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          ai_priority?: boolean
          color?: string | null
          created_at?: string | null
          id?: string
          leads_pipelines_id?: string | null
          name?: string
          order_index?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_stages_leads_pipelines_id_fkey"
            columns: ["leads_pipelines_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_stages_followups: {
        Row: {
          active: boolean | null
          as_queue_id: string | null
          audio_file: string | null
          bh_only_last: boolean
          business_hours_only: boolean
          control: string | null
          created_at: string | null
          days: number
          email_template_id: string | null
          hours: number
          id: string
          lead_type: string | null
          leads_stages_id: string | null
          message: string
          minutes: number
          score_matrix_id: string | null
          subject: string | null
          target_stage_id: string | null
          template_id: string | null
          type: string
          updated_at: string | null
          whatsapp_template_id: string | null
        }
        Insert: {
          active?: boolean | null
          as_queue_id?: string | null
          audio_file?: string | null
          bh_only_last?: boolean
          business_hours_only?: boolean
          control?: string | null
          created_at?: string | null
          days?: number
          email_template_id?: string | null
          hours?: number
          id?: string
          lead_type?: string | null
          leads_stages_id?: string | null
          message: string
          minutes?: number
          score_matrix_id?: string | null
          subject?: string | null
          target_stage_id?: string | null
          template_id?: string | null
          type?: string
          updated_at?: string | null
          whatsapp_template_id?: string | null
        }
        Update: {
          active?: boolean | null
          as_queue_id?: string | null
          audio_file?: string | null
          bh_only_last?: boolean
          business_hours_only?: boolean
          control?: string | null
          created_at?: string | null
          days?: number
          email_template_id?: string | null
          hours?: number
          id?: string
          lead_type?: string | null
          leads_stages_id?: string | null
          message?: string
          minutes?: number
          score_matrix_id?: string | null
          subject?: string | null
          target_stage_id?: string | null
          template_id?: string | null
          type?: string
          updated_at?: string | null
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_stages_followups_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stages_followups_leads_stages_id_fkey"
            columns: ["leads_stages_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_stages_followups_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_tags: {
        Row: {
          created_at: string
          created_by: string | null
          lead_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          lead_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          lead_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tags_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "lead_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_updates: {
        Row: {
          created_at: string | null
          from_stage_id: string | null
          id: string
          lead_id: string | null
          notes: string | null
          to_stage_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          from_stage_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          to_stage_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          from_stage_id?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          to_stage_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_updates_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_updates_leads_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_updates_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_updates_users_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_anonymization_log: {
        Row: {
          created_at: string
          id: string
          performed_by: string | null
          person_id: string
          tables_affected: string[]
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          performed_by?: string | null
          person_id: string
          tables_affected?: string[]
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          performed_by?: string | null
          person_id?: string
          tables_affected?: string[]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_anonymization_log_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lgpd_anonymization_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_followup_queue: {
        Row: {
          as_queue_id: string | null
          channel: string
          created_at: string
          fired_at: string | null
          held_for_bh: boolean
          id: string
          lead_id: string | null
          meeting_id: string
          message_snapshot: string | null
          original_scheduled_for: string | null
          person_id: string | null
          response_body: string | null
          response_status: number | null
          retry_count: number
          rule_id: string
          scheduled_for: string
          status: string
          template_id: string | null
          webhook_url: string | null
        }
        Insert: {
          as_queue_id?: string | null
          channel: string
          created_at?: string
          fired_at?: string | null
          held_for_bh?: boolean
          id?: string
          lead_id?: string | null
          meeting_id: string
          message_snapshot?: string | null
          original_scheduled_for?: string | null
          person_id?: string | null
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          rule_id: string
          scheduled_for: string
          status?: string
          template_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          as_queue_id?: string | null
          channel?: string
          created_at?: string
          fired_at?: string | null
          held_for_bh?: boolean
          id?: string
          lead_id?: string | null
          meeting_id?: string
          message_snapshot?: string | null
          original_scheduled_for?: string | null
          person_id?: string | null
          response_body?: string | null
          response_status?: number | null
          retry_count?: number
          rule_id?: string
          scheduled_for?: string
          status?: string
          template_id?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_followup_queue_leads_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_followup_queue_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_followup_queue_people_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_followup_queue_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "meetings_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_followup_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_records: {
        Row: {
          ai_key_topics: string[] | null
          ai_metadata: Json | null
          ai_next_steps: string[] | null
          ai_objections: string[] | null
          ai_score: number | null
          ai_sentiment: string | null
          content: string | null
          content_format: string | null
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          id: string
          meeting_id: string
          record_type: string
          recorded_at: string | null
          source: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          ai_key_topics?: string[] | null
          ai_metadata?: Json | null
          ai_next_steps?: string[] | null
          ai_objections?: string[] | null
          ai_score?: number | null
          ai_sentiment?: string | null
          content?: string | null
          content_format?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          meeting_id: string
          record_type: string
          recorded_at?: string | null
          source?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          ai_key_topics?: string[] | null
          ai_metadata?: Json | null
          ai_next_steps?: string[] | null
          ai_objections?: string[] | null
          ai_score?: number | null
          ai_sentiment?: string | null
          content?: string | null
          content_format?: string | null
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          id?: string
          meeting_id?: string
          record_type?: string
          recorded_at?: string | null
          source?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_records_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          attendee_emails: string[] | null
          calcom_uid: string | null
          created_at: string | null
          description: string | null
          end_time: string
          gcal_sync_error: string | null
          google_event_id: string | null
          google_last_synced_at: string | null
          id: string
          lead_id: string | null
          location: string | null
          meeting_link: string | null
          meeting_type: string | null
          ms_meeting_id: string | null
          notes: string | null
          outcome: string | null
          people_id: string | null
          source: string | null
          start_time: string
          status: string | null
          teams_id: string | null
          title: string
          updated_at: string | null
          user_id: string | null
          zoom_join_url: string | null
          zoom_meeting_id: string | null
          zoom_sync_error: string | null
        }
        Insert: {
          attendee_emails?: string[] | null
          calcom_uid?: string | null
          created_at?: string | null
          description?: string | null
          end_time: string
          gcal_sync_error?: string | null
          google_event_id?: string | null
          google_last_synced_at?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_link?: string | null
          meeting_type?: string | null
          ms_meeting_id?: string | null
          notes?: string | null
          outcome?: string | null
          people_id?: string | null
          source?: string | null
          start_time: string
          status?: string | null
          teams_id?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_sync_error?: string | null
        }
        Update: {
          attendee_emails?: string[] | null
          calcom_uid?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          gcal_sync_error?: string | null
          google_event_id?: string | null
          google_last_synced_at?: string | null
          id?: string
          lead_id?: string | null
          location?: string | null
          meeting_link?: string | null
          meeting_type?: string | null
          ms_meeting_id?: string | null
          notes?: string | null
          outcome?: string | null
          people_id?: string | null
          source?: string | null
          start_time?: string
          status?: string | null
          teams_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_sync_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_leads_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_teams_id_fkey"
            columns: ["teams_id"]
            isOneToOne: false
            referencedRelation: "settings_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meetings_users_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings_followups: {
        Row: {
          active: boolean
          as_queue_id: string | null
          audio_file: string | null
          bh_only_last: boolean
          business_hours_only: boolean
          channel: string
          control: number | null
          created_at: string
          days: number
          hours: number
          id: string
          meeting_status: string
          message: string | null
          minutes: number
          name: string | null
          source: string
          subject: string | null
          template_id: string | null
          type: string
          updated_at: string
          webhook_url: string | null
          whatsapp_template_id: string | null
        }
        Insert: {
          active?: boolean
          as_queue_id?: string | null
          audio_file?: string | null
          bh_only_last?: boolean
          business_hours_only?: boolean
          channel?: string
          control?: number | null
          created_at?: string
          days?: number
          hours?: number
          id?: string
          meeting_status: string
          message?: string | null
          minutes?: number
          name?: string | null
          source?: string
          subject?: string | null
          template_id?: string | null
          type?: string
          updated_at?: string
          webhook_url?: string | null
          whatsapp_template_id?: string | null
        }
        Update: {
          active?: boolean
          as_queue_id?: string | null
          audio_file?: string | null
          bh_only_last?: boolean
          business_hours_only?: boolean
          channel?: string
          control?: number | null
          created_at?: string
          days?: number
          hours?: number
          id?: string
          meeting_status?: string
          message?: string | null
          minutes?: number
          name?: string | null
          source?: string
          subject?: string | null
          template_id?: string | null
          type?: string
          updated_at?: string
          webhook_url?: string | null
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_followups_whatsapp_template_id_fkey"
            columns: ["whatsapp_template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      message_buffer: {
        Row: {
          channel_type: string | null
          created_at: string
          expires_at: string
          id: string
          messages: Json[]
          people_id: string
          processed: boolean
          processed_at: string | null
          wa_phone_number_id: string | null
        }
        Insert: {
          channel_type?: string | null
          created_at?: string
          expires_at: string
          id?: string
          messages?: Json[]
          people_id: string
          processed?: boolean
          processed_at?: string | null
          wa_phone_number_id?: string | null
        }
        Update: {
          channel_type?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          messages?: Json[]
          people_id?: string
          processed?: boolean
          processed_at?: string | null
          wa_phone_number_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_buffer_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          channel: string | null
          content: string
          created_at: string | null
          delivered_at: string | null
          execution_id: string | null
          followup_id: string | null
          from_contact: string | null
          id: number
          ig_message_id: string | null
          instagram_interaction_type: string | null
          lead_id: string | null
          media_metadata: Json | null
          media_url: string | null
          message_type: string | null
          metadata: Json | null
          module_ref_id: string | null
          parent_message_id: number | null
          people_id: string | null
          post_id: string | null
          read_at: string | null
          seen_at: string | null
          sent_at: string | null
          source_type: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          wa_message_id: string | null
          wa_phone_number_id: string | null
          whatsapp_template_id: string | null
        }
        Insert: {
          channel?: string | null
          content: string
          created_at?: string | null
          delivered_at?: string | null
          execution_id?: string | null
          followup_id?: string | null
          from_contact?: string | null
          id?: number
          ig_message_id?: string | null
          instagram_interaction_type?: string | null
          lead_id?: string | null
          media_metadata?: Json | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          module_ref_id?: string | null
          parent_message_id?: number | null
          people_id?: string | null
          post_id?: string | null
          read_at?: string | null
          seen_at?: string | null
          sent_at?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          wa_message_id?: string | null
          wa_phone_number_id?: string | null
          whatsapp_template_id?: string | null
        }
        Update: {
          channel?: string | null
          content?: string
          created_at?: string | null
          delivered_at?: string | null
          execution_id?: string | null
          followup_id?: string | null
          from_contact?: string | null
          id?: number
          ig_message_id?: string | null
          instagram_interaction_type?: string | null
          lead_id?: string | null
          media_metadata?: Json | null
          media_url?: string | null
          message_type?: string | null
          metadata?: Json | null
          module_ref_id?: string | null
          parent_message_id?: number | null
          people_id?: string | null
          post_id?: string | null
          read_at?: string | null
          seen_at?: string | null
          sent_at?: string | null
          source_type?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          wa_message_id?: string | null
          wa_phone_number_id?: string | null
          whatsapp_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_execution_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "leads_stages_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_leads_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_message_id_fkey"
            columns: ["parent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_users_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_lead_form_pages: {
        Row: {
          access_token: string
          created_at: string
          id: string
          page_id: string
          page_name: string
          subscribed: boolean
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          page_id: string
          page_name: string
          subscribed?: boolean
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          page_id?: string
          page_name?: string
          subscribed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      meta_lead_forms: {
        Row: {
          created_at: string
          field_mapping: Json
          id: string
          meta_form_id: string
          name: string
          page_id: string
          pipeline_id: string | null
          raw_questions: Json | null
          settings: Json
          status: string
          synced_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_mapping?: Json
          id?: string
          meta_form_id: string
          name: string
          page_id: string
          pipeline_id?: string | null
          raw_questions?: Json | null
          settings?: Json
          status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_mapping?: Json
          id?: string
          meta_form_id?: string
          name?: string
          page_id?: string
          pipeline_id?: string | null
          raw_questions?: Json | null
          settings?: Json
          status?: string
          synced_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_lead_forms_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "meta_lead_form_pages"
            referencedColumns: ["page_id"]
          },
          {
            foreignKeyName: "meta_lead_forms_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "meta_lead_form_pages_safe"
            referencedColumns: ["page_id"]
          },
          {
            foreignKeyName: "meta_lead_forms_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          recovery_set_id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          recovery_set_id: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          recovery_set_id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          channel: string | null
          created_at: string
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id: string
          lead_id: string | null
          message_id: number | null
          people_id: string | null
          read_at: string | null
          read_by: string | null
          target_user_id: string | null
          title: string
          unread_messages: number
        }
        Insert: {
          body?: string | null
          channel?: string | null
          created_at?: string
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          lead_id?: string | null
          message_id?: number | null
          people_id?: string | null
          read_at?: string | null
          read_by?: string | null
          target_user_id?: string | null
          title: string
          unread_messages?: number
        }
        Update: {
          body?: string | null
          channel?: string | null
          created_at?: string
          event_type?: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          lead_id?: string | null
          message_id?: number | null
          people_id?: string | null
          read_at?: string | null
          read_by?: string | null
          target_user_id?: string | null
          title?: string
          unread_messages?: number
        }
        Relationships: [
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      omni_channel_alerts: {
        Row: {
          alert_type: string
          channel: string
          created_at: string | null
          details: Json | null
          id: string
          resolved_at: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          channel: string
          created_at?: string | null
          details?: Json | null
          id?: string
          resolved_at?: string | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          channel?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          resolved_at?: string | null
          severity?: string
          title?: string
        }
        Relationships: []
      }
      omni_channel_configs: {
        Row: {
          business_hours: Json | null
          channel: string
          created_at: string | null
          credentials: Json | null
          display_name: string
          id: string
          is_active: boolean | null
          settings: Json | null
          updated_at: string | null
          webhook_fallback: Json | null
        }
        Insert: {
          business_hours?: Json | null
          channel: string
          created_at?: string | null
          credentials?: Json | null
          display_name: string
          id?: string
          is_active?: boolean | null
          settings?: Json | null
          updated_at?: string | null
          webhook_fallback?: Json | null
        }
        Update: {
          business_hours?: Json | null
          channel?: string
          created_at?: string | null
          credentials?: Json | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          settings?: Json | null
          updated_at?: string | null
          webhook_fallback?: Json | null
        }
        Relationships: []
      }
      omni_delivery_dead_letter: {
        Row: {
          attempts: number | null
          channel: string
          created_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          max_attempts: number | null
          message_id: number
          next_retry_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          channel: string
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          message_id: number
          next_retry_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          channel?: string
          created_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number | null
          message_id?: number
          next_retry_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omni_delivery_dead_letter_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      omni_outbound_webhooks: {
        Row: {
          channel: string
          created_at: string | null
          headers: Json | null
          id: string
          is_active: boolean | null
          method: string | null
          name: string
          payload_template: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          channel: string
          created_at?: string | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          method?: string | null
          name: string
          payload_template?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          channel?: string
          created_at?: string | null
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          method?: string | null
          name?: string
          payload_template?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      schedule_automations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          pipeline_id: string
          target_pipeline_id: string
          target_stage_id: string
          trigger_status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id: string
          target_pipeline_id: string
          target_stage_id: string
          trigger_status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          pipeline_id?: string
          target_pipeline_id?: string
          target_stage_id?: string
          trigger_status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_automations_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_automations_target_pipeline_id_fkey"
            columns: ["target_pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_automations_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      score_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          order_index: number
          slug: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          order_index?: number
          slug?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      score_category_items: {
        Row: {
          active: boolean
          category_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          order_index: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_index?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_category_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "score_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      score_matrix: {
        Row: {
          category_selections: Json
          created_at: string | null
          detail_score: string | null
          id: string
          name: string | null
          pre_description_score: string | null
          profile_score: string | null
          score_number: number
          updated_at: string | null
        }
        Insert: {
          category_selections?: Json
          created_at?: string | null
          detail_score?: string | null
          id?: string
          name?: string | null
          pre_description_score?: string | null
          profile_score?: string | null
          score_number: number
          updated_at?: string | null
        }
        Update: {
          category_selections?: Json
          created_at?: string | null
          detail_score?: string | null
          id?: string
          name?: string | null
          pre_description_score?: string | null
          profile_score?: string | null
          score_number?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      score_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      secret_access_log: {
        Row: {
          accessed_at: string
          caller_context: string | null
          id: string
          ip_address: unknown
          secret_name: string
        }
        Insert: {
          accessed_at?: string
          caller_context?: string | null
          id?: string
          ip_address?: unknown
          secret_name: string
        }
        Update: {
          accessed_at?: string
          caller_context?: string | null
          id?: string
          ip_address?: unknown
          secret_name?: string
        }
        Relationships: []
      }
      sends: {
        Row: {
          channel: string
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          delivered_count: number | null
          description: string | null
          error_count: number | null
          failed_count: number
          filter_config: Json | null
          id: string
          last_batch_at: string | null
          message_content: string | null
          name: string
          pipeline_id: string | null
          read_count: number | null
          scheduled_at: string | null
          send_interval_seconds: number
          sent_count: number | null
          stage_ids: string[] | null
          started_at: string | null
          status: string | null
          team_id: string | null
          template_id: string | null
          total_contacts: number | null
          type: string
          updated_at: string | null
          wa_channel_id: string | null
          webhook_id: string | null
        }
        Insert: {
          channel?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          description?: string | null
          error_count?: number | null
          failed_count?: number
          filter_config?: Json | null
          id?: string
          last_batch_at?: string | null
          message_content?: string | null
          name: string
          pipeline_id?: string | null
          read_count?: number | null
          scheduled_at?: string | null
          send_interval_seconds?: number
          sent_count?: number | null
          stage_ids?: string[] | null
          started_at?: string | null
          status?: string | null
          team_id?: string | null
          template_id?: string | null
          total_contacts?: number | null
          type?: string
          updated_at?: string | null
          wa_channel_id?: string | null
          webhook_id?: string | null
        }
        Update: {
          channel?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          description?: string | null
          error_count?: number | null
          failed_count?: number
          filter_config?: Json | null
          id?: string
          last_batch_at?: string | null
          message_content?: string | null
          name?: string
          pipeline_id?: string | null
          read_count?: number | null
          scheduled_at?: string | null
          send_interval_seconds?: number
          sent_count?: number | null
          stage_ids?: string[] | null
          started_at?: string | null
          status?: string | null
          team_id?: string | null
          template_id?: string | null
          total_contacts?: number | null
          type?: string
          updated_at?: string | null
          wa_channel_id?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sends_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "settings_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_wa_channel_id_fkey"
            columns: ["wa_channel_id"]
            isOneToOne: false
            referencedRelation: "settings_whatsapp_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      sends_contacts: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          people_id: string | null
          read_at: string | null
          retry_count: number
          send_id: string | null
          sent_at: string | null
          status: string | null
          whatsapp: string
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          people_id?: string | null
          read_at?: string | null
          retry_count?: number
          send_id?: string | null
          sent_at?: string | null
          status?: string | null
          whatsapp: string
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          people_id?: string | null
          read_at?: string | null
          retry_count?: number
          send_id?: string | null
          sent_at?: string | null
          status?: string | null
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "sends_contacts_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_contacts_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "sends"
            referencedColumns: ["id"]
          },
        ]
      }
      sends_import_sessions: {
        Row: {
          created_at: string
          error_message: string | null
          existing_people: number
          failed_rows: number
          id: string
          new_people: number
          processed: number
          send_id: string | null
          status: string
          total_rows: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          existing_people?: number
          failed_rows?: number
          id?: string
          new_people?: number
          processed?: number
          send_id?: string | null
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          existing_people?: number
          failed_rows?: number
          id?: string
          new_people?: number
          processed?: number
          send_id?: string | null
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sends_import_sessions_send_id_fkey"
            columns: ["send_id"]
            isOneToOne: false
            referencedRelation: "sends"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          accent_color: string | null
          address: string | null
          apify_token: string | null
          apollo_api_key: string | null
          bi_voice_chat_beta_enabled: boolean
          brand_primary_color: string | null
          brand_secondary_color: string | null
          calcom_client_id: string | null
          company_name: string
          created_at: string | null
          currency: string | null
          custom_domain: string | null
          email: string | null
          explorium_api_key: string | null
          google_client_id: string | null
          google_client_secret: string | null
          id: string
          language: string | null
          login_max_attempts: number | null
          logo_url: string | null
          mfa_policy: string | null
          pdl_api_key: string | null
          phone: string | null
          primary_color: string | null
          product_name: string | null
          require_mfa_for_gestores: boolean | null
          secondary_color: string | null
          tax_id: string | null
          timezone: string | null
          updated_at: string | null
          website: string | null
          whatsapp_provider: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          apify_token?: string | null
          apollo_api_key?: string | null
          bi_voice_chat_beta_enabled?: boolean
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          calcom_client_id?: string | null
          company_name: string
          created_at?: string | null
          currency?: string | null
          custom_domain?: string | null
          email?: string | null
          explorium_api_key?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          id?: string
          language?: string | null
          login_max_attempts?: number | null
          logo_url?: string | null
          mfa_policy?: string | null
          pdl_api_key?: string | null
          phone?: string | null
          primary_color?: string | null
          product_name?: string | null
          require_mfa_for_gestores?: boolean | null
          secondary_color?: string | null
          tax_id?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
          whatsapp_provider?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          apify_token?: string | null
          apollo_api_key?: string | null
          bi_voice_chat_beta_enabled?: boolean
          brand_primary_color?: string | null
          brand_secondary_color?: string | null
          calcom_client_id?: string | null
          company_name?: string
          created_at?: string | null
          currency?: string | null
          custom_domain?: string | null
          email?: string | null
          explorium_api_key?: string | null
          google_client_id?: string | null
          google_client_secret?: string | null
          id?: string
          language?: string | null
          login_max_attempts?: number | null
          logo_url?: string | null
          mfa_policy?: string | null
          pdl_api_key?: string | null
          phone?: string | null
          primary_color?: string | null
          product_name?: string | null
          require_mfa_for_gestores?: boolean | null
          secondary_color?: string | null
          tax_id?: string | null
          timezone?: string | null
          updated_at?: string | null
          website?: string | null
          whatsapp_provider?: string | null
        }
        Relationships: []
      }
      settings_ai_providers: {
        Row: {
          active: boolean
          api_key: string
          created_at: string
          id: string
          is_default: boolean
          label: string
          provider: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          api_key: string
          created_at?: string
          id?: string
          is_default?: boolean
          label: string
          provider: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          api_key?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings_audit_log: {
        Row: {
          changed_at: string
          field: string
          id: string
          is_sensitive: boolean
          new_value: string | null
          old_value: string | null
          section: string
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          changed_at?: string
          field: string
          id?: string
          is_sensitive?: boolean
          new_value?: string | null
          old_value?: string | null
          section: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          changed_at?: string
          field?: string
          id?: string
          is_sensitive?: boolean
          new_value?: string | null
          old_value?: string | null
          section?: string
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      settings_business_hours: {
        Row: {
          bh_only_last: boolean
          created_at: string
          days_of_week: number[]
          enabled: boolean
          end_hour: number
          id: string
          start_hour: number
          timezone: string
          updated_at: string
        }
        Insert: {
          bh_only_last?: boolean
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          end_hour?: number
          id?: string
          start_hour?: number
          timezone?: string
          updated_at?: string
        }
        Update: {
          bh_only_last?: boolean
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          end_hour?: number
          id?: string
          start_hour?: number
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      settings_elevenlabs: {
        Row: {
          active: boolean | null
          api_key: string | null
          api_key_encrypted: string | null
          created_at: string
          default_model_id: string | null
          default_output_format: string | null
          default_voice_id: string | null
          id: string
          monthly_char_limit: number | null
          monthly_char_used: number | null
          monthly_reset_at: string | null
          updated_at: string
          webhook_secret: string | null
          workspace_id: string | null
        }
        Insert: {
          active?: boolean | null
          api_key?: string | null
          api_key_encrypted?: string | null
          created_at?: string
          default_model_id?: string | null
          default_output_format?: string | null
          default_voice_id?: string | null
          id?: string
          monthly_char_limit?: number | null
          monthly_char_used?: number | null
          monthly_reset_at?: string | null
          updated_at?: string
          webhook_secret?: string | null
          workspace_id?: string | null
        }
        Update: {
          active?: boolean | null
          api_key?: string | null
          api_key_encrypted?: string | null
          created_at?: string
          default_model_id?: string | null
          default_output_format?: string | null
          default_voice_id?: string | null
          id?: string
          monthly_char_limit?: number | null
          monthly_char_used?: number | null
          monthly_reset_at?: string | null
          updated_at?: string
          webhook_secret?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      settings_omni_new_contact: {
        Row: {
          auto_create_negocio: boolean
          channel: string
          id: string
          on_first_reply_enabled: boolean
          on_first_reply_stage_id: string | null
          pipeline_id: string | null
          stage_id: string | null
          title_template: string
          updated_at: string | null
        }
        Insert: {
          auto_create_negocio?: boolean
          channel: string
          id?: string
          on_first_reply_enabled?: boolean
          on_first_reply_stage_id?: string | null
          pipeline_id?: string | null
          stage_id?: string | null
          title_template?: string
          updated_at?: string | null
        }
        Update: {
          auto_create_negocio?: boolean
          channel?: string
          id?: string
          on_first_reply_enabled?: boolean
          on_first_reply_stage_id?: string | null
          pipeline_id?: string | null
          stage_id?: string | null
          title_template?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_omni_new_contact_on_first_reply_stage_id_fkey"
            columns: ["on_first_reply_stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_omni_new_contact_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_omni_new_contact_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "leads_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_schedules: {
        Row: {
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean | null
          start_time: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_available?: boolean | null
          start_time: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_system_modules: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          module_key: string
          module_name: string
          order_index: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          module_key: string
          module_name: string
          order_index: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          module_key?: string
          module_name?: string
          order_index?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      settings_teams: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          priority: number | null
          team_type: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          priority?: number | null
          team_type?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          priority?: number | null
          team_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      settings_teams_pipelines: {
        Row: {
          created_at: string
          pipeline_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          pipeline_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          pipeline_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_teams_pipelines_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_teams_pipelines_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "settings_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_teams_tags: {
        Row: {
          created_at: string
          tag_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          tag_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          tag_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settings_teams_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "lead_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_teams_tags_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "settings_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_users: {
        Row: {
          active: boolean | null
          agente: string | null
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          id: string
          mfa_grace_until: string | null
          name: string
          phone: string | null
          role_id: string | null
          super_admin: boolean | null
          updated_at: string | null
          user_type: string | null
        }
        Insert: {
          active?: boolean | null
          agente?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          id?: string
          mfa_grace_until?: string | null
          name: string
          phone?: string | null
          role_id?: string | null
          super_admin?: boolean | null
          updated_at?: string | null
          user_type?: string | null
        }
        Update: {
          active?: boolean | null
          agente?: string | null
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          id?: string
          mfa_grace_until?: string | null
          name?: string
          phone?: string | null
          role_id?: string | null
          super_admin?: boolean | null
          updated_at?: string | null
          user_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "tenant_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_users_teams: {
        Row: {
          created_at: string | null
          id: string
          is_leader: boolean | null
          is_priority: boolean
          team_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_leader?: boolean | null
          is_priority?: boolean
          team_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_leader?: boolean | null
          is_priority?: boolean
          team_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settings_users_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "settings_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settings_users_teams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      settings_whatsapp_channels: {
        Row: {
          access_token: string | null
          active: boolean
          app_secret: string | null
          created_at: string
          evolution_api_key: string | null
          evolution_base_url: string | null
          evolution_instance_name: string | null
          evolution_last_seen_at: string | null
          evolution_status: string | null
          evolution_webhook_token: string | null
          id: string
          is_default: boolean
          label: string
          phone_number_id: string | null
          provider: string
          updated_at: string
          waba_id: string | null
        }
        Insert: {
          access_token?: string | null
          active?: boolean
          app_secret?: string | null
          created_at?: string
          evolution_api_key?: string | null
          evolution_base_url?: string | null
          evolution_instance_name?: string | null
          evolution_last_seen_at?: string | null
          evolution_status?: string | null
          evolution_webhook_token?: string | null
          id?: string
          is_default?: boolean
          label: string
          phone_number_id?: string | null
          provider?: string
          updated_at?: string
          waba_id?: string | null
        }
        Update: {
          access_token?: string | null
          active?: boolean
          app_secret?: string | null
          created_at?: string
          evolution_api_key?: string | null
          evolution_base_url?: string | null
          evolution_instance_name?: string | null
          evolution_last_seen_at?: string | null
          evolution_status?: string | null
          evolution_webhook_token?: string | null
          id?: string
          is_default?: boolean
          label?: string
          phone_number_id?: string | null
          provider?: string
          updated_at?: string
          waba_id?: string | null
        }
        Relationships: []
      }
      tenant_api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_api_keys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "crm_tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_role_permissions: {
        Row: {
          enabled: boolean
          feature_key: Database["public"]["Enums"]["feature_key"]
          id: string
          role_id: string
        }
        Insert: {
          enabled?: boolean
          feature_key: Database["public"]["Enums"]["feature_key"]
          id?: string
          role_id: string
        }
        Update: {
          enabled?: boolean
          feature_key?: Database["public"]["Enums"]["feature_key"]
          id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "tenant_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          name: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          name?: string
          tenant_id?: string
        }
        Relationships: []
      }
      user_calcom_connections: {
        Row: {
          calcom_access_token: string
          calcom_refresh_token: string
          calcom_token_expires_at: string | null
          calcom_username: string | null
          created_at: string
          default_booking_url: string | null
          default_event_type_id: number | null
          default_event_type_slug: string | null
          id: string
          is_active: boolean
          sync_booking: boolean
          updated_at: string
          use_calcom_booking_link: boolean
          user_id: string
          webhook_id: string | null
          webhook_secret: string | null
        }
        Insert: {
          calcom_access_token: string
          calcom_refresh_token: string
          calcom_token_expires_at?: string | null
          calcom_username?: string | null
          created_at?: string
          default_booking_url?: string | null
          default_event_type_id?: number | null
          default_event_type_slug?: string | null
          id?: string
          is_active?: boolean
          sync_booking?: boolean
          updated_at?: string
          use_calcom_booking_link?: boolean
          user_id: string
          webhook_id?: string | null
          webhook_secret?: string | null
        }
        Update: {
          calcom_access_token?: string
          calcom_refresh_token?: string
          calcom_token_expires_at?: string | null
          calcom_username?: string | null
          created_at?: string
          default_booking_url?: string | null
          default_event_type_id?: number | null
          default_event_type_slug?: string | null
          id?: string
          is_active?: boolean
          sync_booking?: boolean
          updated_at?: string
          use_calcom_booking_link?: boolean
          user_id?: string
          webhook_id?: string | null
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_calcom_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_calendar_connections: {
        Row: {
          created_at: string
          google_access_token: string | null
          google_calendar_id: string
          google_email: string | null
          google_refresh_token: string | null
          google_token_expires_at: string | null
          id: string
          is_active: boolean
          ms_access_token: string | null
          ms_email: string | null
          ms_refresh_token: string | null
          ms_token_expires_at: string | null
          ms_user_id: string | null
          provider: string
          sync_booking: boolean
          updated_at: string
          user_id: string
          zoom_access_token: string | null
          zoom_account_id: string | null
          zoom_email: string | null
          zoom_refresh_token: string | null
          zoom_token_expires_at: string | null
          zoom_user_id: string | null
        }
        Insert: {
          created_at?: string
          google_access_token?: string | null
          google_calendar_id?: string
          google_email?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          is_active?: boolean
          ms_access_token?: string | null
          ms_email?: string | null
          ms_refresh_token?: string | null
          ms_token_expires_at?: string | null
          ms_user_id?: string | null
          provider?: string
          sync_booking?: boolean
          updated_at?: string
          user_id: string
          zoom_access_token?: string | null
          zoom_account_id?: string | null
          zoom_email?: string | null
          zoom_refresh_token?: string | null
          zoom_token_expires_at?: string | null
          zoom_user_id?: string | null
        }
        Update: {
          created_at?: string
          google_access_token?: string | null
          google_calendar_id?: string
          google_email?: string | null
          google_refresh_token?: string | null
          google_token_expires_at?: string | null
          id?: string
          is_active?: boolean
          ms_access_token?: string | null
          ms_email?: string | null
          ms_refresh_token?: string | null
          ms_token_expires_at?: string | null
          ms_user_id?: string | null
          provider?: string
          sync_booking?: boolean
          updated_at?: string
          user_id?: string
          zoom_access_token?: string | null
          zoom_account_id?: string | null
          zoom_email?: string | null
          zoom_refresh_token?: string | null
          zoom_token_expires_at?: string | null
          zoom_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_calendar_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "settings_users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled: boolean
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id: string
          snoozed_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: Database["public"]["Enums"]["notification_channel"]
          enabled?: boolean
          event_type: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          snoozed_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["notification_channel"]
          enabled?: boolean
          event_type?: Database["public"]["Enums"]["notification_event_type"]
          id?: string
          snoozed_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          channel: string | null
          created_at: string | null
          error_detail: string | null
          error_message: string | null
          event: string | null
          id: string
          message_id: string | null
          payload: Json | null
          people_id: string | null
          request_body: Json | null
          response_body: Json | null
          source: string | null
          status_code: number | null
          subscriber_id: string | null
          webhook_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          error_detail?: string | null
          error_message?: string | null
          event?: string | null
          id?: string
          message_id?: string | null
          payload?: Json | null
          people_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          source?: string | null
          status_code?: number | null
          subscriber_id?: string | null
          webhook_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          error_detail?: string | null
          error_message?: string | null
          event?: string | null
          id?: string
          message_id?: string | null
          payload?: Json | null
          people_id?: string | null
          request_body?: Json | null
          response_body?: Json | null
          source?: string | null
          status_code?: number | null
          subscriber_id?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_people_id_fkey"
            columns: ["people_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          active: boolean | null
          created_at: string | null
          event_type: string
          headers: Json | null
          id: string
          name: string
          pipeline_id: string | null
          stage_ids: string[]
          updated_at: string | null
          url: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          event_type: string
          headers?: Json | null
          id?: string
          name: string
          pipeline_id?: string | null
          stage_ids?: string[]
          updated_at?: string | null
          url: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          event_type?: string
          headers?: Json | null
          id?: string
          name?: string
          pipeline_id?: string | null
          stage_ids?: string[]
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "leads_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          created_at: string | null
          id: string
          id_template: string
          json_data: Json | null
          last_synced_at: string | null
          meta_template_name: string | null
          name: string
          provider: string
          purpose: string | null
          slug: string
          status: string | null
          system_enabled: boolean | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          id_template: string
          json_data?: Json | null
          last_synced_at?: string | null
          meta_template_name?: string | null
          name: string
          provider?: string
          purpose?: string | null
          slug: string
          status?: string | null
          system_enabled?: boolean | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          id_template?: string
          json_data?: Json | null
          last_synced_at?: string | null
          meta_template_name?: string | null
          name?: string
          provider?: string
          purpose?: string | null
          slug?: string
          status?: string | null
          system_enabled?: boolean | null
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      followup_queue_legacy: {
        Row: {
          assunto: string | null
          canal: string | null
          channel: string | null
          created_at: string | null
          error_message: string | null
          fired_at: string | null
          followup_id: string | null
          id: string | null
          lead_id: string | null
          meeting_followup_id: string | null
          message: string | null
          message_id: number | null
          person_id: string | null
          phone_number: string | null
          response_data: Json | null
          retry_count: number | null
          scheduled_at: string | null
          scheduled_for: string | null
          source_type: string | null
          status: string | null
          subject: string | null
          template_id: string | null
          updated_at: string | null
        }
        Insert: {
          assunto?: string | null
          canal?: string | null
          channel?: string | null
          created_at?: string | null
          error_message?: string | null
          fired_at?: string | null
          followup_id?: string | null
          id?: string | null
          lead_id?: string | null
          meeting_followup_id?: string | null
          message?: string | null
          message_id?: number | null
          person_id?: string | null
          phone_number?: string | null
          response_data?: Json | null
          retry_count?: number | null
          scheduled_at?: string | null
          scheduled_for?: string | null
          source_type?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Update: {
          assunto?: string | null
          canal?: string | null
          channel?: string | null
          created_at?: string | null
          error_message?: string | null
          fired_at?: string | null
          followup_id?: string | null
          id?: string | null
          lead_id?: string | null
          meeting_followup_id?: string | null
          message?: string | null
          message_id?: number | null
          person_id?: string | null
          phone_number?: string | null
          response_data?: Json | null
          retry_count?: number | null
          scheduled_at?: string | null
          scheduled_for?: string | null
          source_type?: string | null
          status?: string | null
          subject?: string | null
          template_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_queue_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "leads_stages_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_queue_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_queue_meeting_followup_id_fkey"
            columns: ["meeting_followup_id"]
            isOneToOne: false
            referencedRelation: "meetings_followups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_queue_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followup_queue_pessoa_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "clients_people"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_lead_form_pages_safe: {
        Row: {
          created_at: string | null
          id: string | null
          page_id: string | null
          page_name: string | null
          subscribed: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          page_id?: string | null
          page_name?: string | null
          subscribed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          page_id?: string | null
          page_name?: string | null
          subscribed?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_lead_to_pipeline: {
        Args: { p_lead_id: string; p_target_pipeline_id: string }
        Returns: Json
      }
      adm_client_decrypted_secrets: {
        Args: { p_client_id: string }
        Returns: {
          db_password: string
          management_token: string
          service_role_key: string
        }[]
      }
      adm_clients_secrets_status: {
        Args: never
        Returns: {
          has_db_password: boolean
          has_management_token: boolean
          has_service_role_key: boolean
          id: string
        }[]
      }
      adm_timeout_stuck_jobs: { Args: never; Returns: number }
      ai_agent_watchdog: { Args: never; Returns: undefined }
      anonymize_person: { Args: { p_person_id: string }; Returns: Json }
      app_decrypt_secret: {
        Args: { p_context: string; p_encrypted: string }
        Returns: string
      }
      app_encrypt_secret: {
        Args: { p_context: string; p_value: string }
        Returns: string
      }
      append_crm_field_value: {
        Args: { p_field_key: string; p_new_value: string; p_person_id: string }
        Returns: undefined
      }
      assign_lead_round_robin: {
        Args: { p_lead_id: string; p_team_id: string }
        Returns: string
      }
      audit_value: { Args: { col_name: string; val: string }; Returns: string }
      book_meeting:
        | {
            Args: {
              p_duration?: number
              p_end_time: string
              p_exclude_user_ids?: string[]
              p_lead_id: string
              p_notes?: string
              p_rule_set_id?: string
              p_start_time: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_duration_minutes?: number
              p_lead_id: string
              p_notes?: string
              p_start_ts: string
              p_title: string
              p_user_id: string
            }
            Returns: string
          }
      check_bi_voice_beta_update: { Args: never; Returns: boolean }
      claim_followup_queue_batch: {
        Args: { p_limit?: number }
        Returns: {
          channel: string
          created_at: string
          error_message: string | null
          fired_at: string | null
          followup_id: string | null
          held_for_bh: boolean
          id: string
          lead_id: string
          meeting_followup_id: string | null
          message: string | null
          message_id: number | null
          original_scheduled_for: string | null
          person_id: string | null
          phone_number: string | null
          response_data: Json | null
          retry_count: number
          scheduled_for: string
          source_type: string
          status: string
          subject: string | null
          template_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "followup_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_pending_messages: {
        Args: {
          p_batch_size?: number
          p_channel?: string
          p_max_age_hours?: number
          p_people_id?: string
        }
        Returns: {
          channel: string
          content: string
          execution_id: string
          id: number
          lead_id: string
          media_metadata: Json
          media_url: string
          message_type: string
          metadata: Json
          module_ref_id: string
          people_id: string
          sent_at: string
          source_type: string
          user_id: string
          wa_phone_number_id: string
          whatsapp_template_id: string
        }[]
      }
      cleanup_agent_history: {
        Args: { p_agent_id: string; p_keep_versions?: number }
        Returns: undefined
      }
      cleanup_auth_login_attempts: { Args: never; Returns: undefined }
      cleanup_bi_voice_token_log: { Args: never; Returns: undefined }
      create_tenant_user: {
        Args: {
          p_email: string
          p_name: string
          p_password: string
          p_phone?: string
          p_super_admin?: boolean
          p_user_type?: string
        }
        Returns: Json
      }
      decrypt_elevenlabs_key: {
        Args: { encrypted_key: string }
        Returns: string
      }
      encrypt_elevenlabs_key: { Args: { key_value: string }; Returns: string }
      find_duplicate_person: {
        Args: {
          p_document?: string
          p_email?: string
          p_exclude_id: string
          p_instagram_handle?: string
          p_instagram_user_id?: string
          p_whatsapp?: string
        }
        Returns: string
      }
      get_active_ai_provider_key: {
        Args: { p_provider: string }
        Returns: string
      }
      get_available_slots: {
        Args: {
          p_date: string
          p_period?: string
          p_slot_minutes?: number
          p_user_id: string
        }
        Returns: Json
      }
      get_booking_eligible_user_ids:
        | { Args: { p_rule_set_id?: string }; Returns: string[] }
        | {
            Args: { p_pipeline_id?: string; p_rule_set_id?: string }
            Returns: string[]
          }
      get_booking_session: {
        Args: {
          p_days_ahead?: number
          p_duration?: number
          p_lead_id: string
          p_rule_set_id?: string
        }
        Returns: Json
      }
      get_current_settings_user_id: { Args: never; Returns: string }
      get_current_user_tenant_id: { Args: never; Returns: string }
      get_insights_context: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_pipeline_id?: string
        }
        Returns: Json
      }
      get_omni_contacts: {
        Args: {
          p_atend_ia?: string
          p_etapa?: string
          p_filtro_data?: string
          p_limit?: number
          p_offset?: number
          p_pipeline?: string
          p_responsavel?: string
          p_search_term?: string
          p_status_atend?: string
          p_tag?: string
          p_time?: string
        }
        Returns: {
          contact: Json
          total_count: number
        }[]
      }
      get_public_settings: {
        Args: never
        Returns: {
          company_name: string
          logo_url: string
        }[]
      }
      import_pessoa_with_flexible_lead: {
        Args: {
          modo_operacao?: string
          pessoa_data: Json
          pipeline_id_param: string
          tenant_id_param: string
        }
        Returns: Json
      }
      increment_field: {
        Args: {
          field_name: string
          increment_by?: number
          row_id: string
          table_name: string
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_gestor: { Args: never; Returns: boolean }
      is_admin_or_manager: { Args: never; Returns: boolean }
      is_sensitive_column: { Args: { col_name: string }; Returns: boolean }
      lead_pipeline_accessible_to_current_user: {
        Args: { p_leads_pipelines_id: string }
        Returns: boolean
      }
      link_pipeline_to_kiwify_product: {
        Args: {
          p_move_existing_leads?: boolean
          p_pipeline_id: string
          p_product_id: string
          p_product_name: string
        }
        Returns: Json
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_conversation_read: { Args: { p_people_id: string }; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      merge_persons: {
        Args: { p_canonical_id: string; p_duplicate_id: string }
        Returns: Json
      }
      mfa_recovery_consume: { Args: { p_code: string }; Returns: Json }
      mfa_recovery_generate: { Args: never; Returns: string[] }
      move_lead_to_stage: {
        Args: { p_lead_id: string; p_stage_name: string }
        Returns: undefined
      }
      person_conversation_accessible_to_current_user: {
        Args: { p_people_id: string }
        Returns: boolean
      }
      process_message_buffer: { Args: never; Returns: undefined }
      recalc_unread_count: {
        Args: { p_people_id?: string }
        Returns: undefined
      }
      release_stale_ai_locks: { Args: never; Returns: undefined }
      reorder_leads_stage: {
        Args: {
          p_new_position: number
          p_pipeline_id: string
          p_stage_id: string
        }
        Returns: undefined
      }
      reset_stale_sending_messages: { Args: never; Returns: undefined }
      restore_agent_version: {
        Args: { p_agent_id: string; p_history_id: string }
        Returns: undefined
      }
      save_agent_complete: {
        Args: {
          p_agent_data: Json
          p_agent_id: string
          p_changelog?: Json
          p_created_by?: string
          p_steps_data?: Json
        }
        Returns: Json
      }
      secure_http_post: {
        Args: {
          body: Json
          caller_context?: string
          secret_name: string
          url: string
        }
        Returns: undefined
      }
      seed_default_tenant_roles: {
        Args: { p_tenant_id: string }
        Returns: undefined
      }
      set_booking_lead_email: {
        Args: { p_email: string; p_lead_id: string }
        Returns: Json
      }
      sync_custom_domain_to_adm: {
        Args: { p_custom_domain: string; p_tenant_id: string }
        Returns: undefined
      }
      sync_service_role_from_vault: { Args: never; Returns: undefined }
      tag_accessible_to_current_user: {
        Args: { p_tag_id: string }
        Returns: boolean
      }
      trigger_followup_retry_worker: { Args: never; Returns: undefined }
      trigger_followup_worker: { Args: never; Returns: undefined }
      trigger_fwup01_smoke_test: {
        Args: never
        Returns: {
          check_name: string
          detail: string
          status: string
        }[]
      }
      trigger_google_calendar_sync: { Args: never; Returns: undefined }
      trigger_instagram_token_refresh: { Args: never; Returns: undefined }
      trigger_omni_channel_health_check: { Args: never; Returns: undefined }
      trigger_omni_delivery_engine: { Args: never; Returns: undefined }
      trigger_omni_retry_dead_letter: { Args: never; Returns: undefined }
      trigger_process_meeting_followups: { Args: never; Returns: undefined }
      trigger_sends_dispatch_batch: { Args: never; Returns: undefined }
      trigger_zoom_token_refresh: { Args: never; Returns: undefined }
      unlink_pipeline_kiwify_product: {
        Args: { p_pipeline_id: string }
        Returns: Json
      }
      update_meeting: {
        Args: {
          p_duration_minutes?: number
          p_meeting_id: string
          p_notes?: string
          p_start_ts?: string
          p_status: string
        }
        Returns: undefined
      }
      update_qualification_field: {
        Args: { p_field_key: string; p_person_id: string; p_value: string }
        Returns: undefined
      }
      upsert_crm_field_value: {
        Args: { p_field_key: string; p_person_id: string; p_value: string }
        Returns: undefined
      }
      upsert_field_value: {
        Args: { p_field_key: string; p_person_id: string; p_value: string }
        Returns: undefined
      }
      user_has_tenant_access: {
        Args: { target_tenant_id: string }
        Returns: boolean
      }
      validate_stage_ids: { Args: { p_stage_ids: string[] }; Returns: boolean }
    }
    Enums: {
      feature_key:
        | "crm_export"
        | "crm_delete"
        | "score_view"
        | "coach_view"
        | "coach_edit"
        | "sends_create"
        | "bi_view"
        | "settings_view"
      notification_channel: "in_app" | "email" | "whatsapp"
      notification_event_type:
        | "lead_assigned"
        | "followup_due"
        | "meeting_scheduled"
        | "coach_evaluation_ready"
        | "transcript_ready"
        | "word_spotting_triggered"
        | "inbound_message"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      feature_key: [
        "crm_export",
        "crm_delete",
        "score_view",
        "coach_view",
        "coach_edit",
        "sends_create",
        "bi_view",
        "settings_view",
      ],
      notification_channel: ["in_app", "email", "whatsapp"],
      notification_event_type: [
        "lead_assigned",
        "followup_due",
        "meeting_scheduled",
        "coach_evaluation_ready",
        "transcript_ready",
        "word_spotting_triggered",
        "inbound_message",
      ],
    },
  },
} as const
