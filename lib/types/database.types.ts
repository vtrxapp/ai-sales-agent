// Generated from the live Supabase schema (project kivqnyguyjqvoeypeqol) via
// the Supabase MCP `generate_typescript_types` tool. Do not hand-edit -
// regenerate after every migration instead.

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
      activities: {
        Row: {
          activity_type: string
          actor_id: string | null
          campaign_id: string | null
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          product_id: string | null
        }
        Insert: {
          activity_type: string
          actor_id?: string | null
          campaign_id?: string | null
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          product_id?: string | null
        }
        Update: {
          activity_type?: string
          actor_id?: string | null
          campaign_id?: string | null
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      business_research_notes: {
        Row: {
          business_id: string
          confidence: number | null
          digital_presence: Json
          id: string
          inferences: Json
          model: string
          observations: Json
          recommendations: Json
          researched_at: string
          researched_by: string | null
          source_urls: Json
        }
        Insert: {
          business_id: string
          confidence?: number | null
          digital_presence?: Json
          id?: string
          inferences?: Json
          model: string
          observations?: Json
          recommendations?: Json
          researched_at?: string
          researched_by?: string | null
          source_urls?: Json
        }
        Update: {
          business_id?: string
          confidence?: number | null
          digital_presence?: Json
          id?: string
          inferences?: Json
          model?: string
          observations?: Json
          recommendations?: Json
          researched_at?: string
          researched_by?: string | null
          source_urls?: Json
        }
        Relationships: [
          {
            foreignKeyName: "business_research_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_research_notes_researched_by_fkey"
            columns: ["researched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          description: string | null
          discovered_at: string
          do_not_contact: boolean
          do_not_contact_at: string | null
          do_not_contact_reason: string | null
          email: string | null
          id: string
          industry: string | null
          last_researched_at: string | null
          location: string | null
          name: string
          name_normalized: string
          phone: string | null
          phone_normalized: string | null
          pipeline_status: Database["public"]["Enums"]["pipeline_status"]
          social_links: Json
          source: string
          source_url: string | null
          updated_at: string
          website: string | null
          website_normalized: string | null
          whatsapp_number: string | null
          whatsapp_status: Database["public"]["Enums"]["whatsapp_status"]
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discovered_at?: string
          do_not_contact?: boolean
          do_not_contact_at?: string | null
          do_not_contact_reason?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          last_researched_at?: string | null
          location?: string | null
          name: string
          name_normalized: string
          phone?: string | null
          phone_normalized?: string | null
          pipeline_status?: Database["public"]["Enums"]["pipeline_status"]
          social_links?: Json
          source: string
          source_url?: string | null
          updated_at?: string
          website?: string | null
          website_normalized?: string | null
          whatsapp_number?: string | null
          whatsapp_status?: Database["public"]["Enums"]["whatsapp_status"]
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discovered_at?: string
          do_not_contact?: boolean
          do_not_contact_at?: string | null
          do_not_contact_reason?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          last_researched_at?: string | null
          location?: string | null
          name?: string
          name_normalized?: string
          phone?: string | null
          phone_normalized?: string | null
          pipeline_status?: Database["public"]["Enums"]["pipeline_status"]
          social_links?: Json
          source?: string
          source_url?: string | null
          updated_at?: string
          website?: string | null
          website_normalized?: string | null
          whatsapp_number?: string | null
          whatsapp_status?: Database["public"]["Enums"]["whatsapp_status"]
        }
        Relationships: [
          {
            foreignKeyName: "businesses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget: number | null
          campaign_type: Database["public"]["Enums"]["campaign_type"]
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          objective: string | null
          product_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          target_audience: string | null
          target_location: string | null
          updated_at: string
        }
        Insert: {
          budget?: number | null
          campaign_type: Database["public"]["Enums"]["campaign_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          objective?: string | null
          product_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_audience?: string | null
          target_location?: string | null
          updated_at?: string
        }
        Update: {
          budget?: number | null
          campaign_type?: Database["public"]["Enums"]["campaign_type"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          objective?: string | null
          product_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_audience?: string | null
          target_location?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          job_title: string | null
          name: string
          phone: string | null
          social_url: string | null
          source: string
          updated_at: string
          verification_status: Database["public"]["Enums"]["contact_verification_status"]
          whatsapp_number: string | null
          whatsapp_status: Database["public"]["Enums"]["whatsapp_status"]
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          job_title?: string | null
          name: string
          phone?: string | null
          social_url?: string | null
          source: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["contact_verification_status"]
          whatsapp_number?: string | null
          whatsapp_status?: Database["public"]["Enums"]["whatsapp_status"]
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          job_title?: string | null
          name?: string
          phone?: string | null
          social_url?: string | null
          source?: string
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["contact_verification_status"]
          whatsapp_number?: string | null
          whatsapp_status?: Database["public"]["Enums"]["whatsapp_status"]
        }
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scores: {
        Row: {
          business_id: string
          business_potential_score: number
          classification: Database["public"]["Enums"]["lead_classification"]
          confidence: number | null
          contactability_score: number
          created_at: string
          digital_problems_score: number
          growth_potential_score: number
          id: string
          industry_fit_score: number
          missing_functionality_score: number
          model: string
          other_score: number
          reasoning: Json
          scored_at: string
          scored_by: string | null
          total_score: number
          updated_at: string
        }
        Insert: {
          business_id: string
          business_potential_score: number
          classification: Database["public"]["Enums"]["lead_classification"]
          confidence?: number | null
          contactability_score: number
          created_at?: string
          digital_problems_score: number
          growth_potential_score: number
          id?: string
          industry_fit_score: number
          missing_functionality_score: number
          model: string
          other_score: number
          reasoning?: Json
          scored_at?: string
          scored_by?: string | null
          total_score: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          business_potential_score?: number
          classification?: Database["public"]["Enums"]["lead_classification"]
          confidence?: number | null
          contactability_score?: number
          created_at?: string
          digital_problems_score?: number
          growth_potential_score?: number
          id?: string
          industry_fit_score?: number
          missing_functionality_score?: number
          model?: string
          other_score?: number
          reasoning?: Json
          scored_at?: string
          scored_by?: string | null
          total_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_scores_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_scores_scored_by_fkey"
            columns: ["scored_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          audit_id: string | null
          business_id: string
          business_impact_score: number | null
          commercial_fit_score: number | null
          confidence: number | null
          created_at: string
          created_by: string | null
          customer_need_score: number | null
          description: string | null
          estimated_complexity:
            | Database["public"]["Enums"]["opportunity_complexity"]
            | null
          estimated_value: number | null
          evidence: string | null
          evidence_strength_score: number | null
          expected_benefit: string | null
          feasibility_score: number | null
          id: string
          last_detected_at: string
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          priority: Database["public"]["Enums"]["opportunity_priority"]
          problem: string | null
          proposed_solution: string | null
          recommended_service: string | null
          score: number | null
          score_reasoning: Json
          source: string
          status: Database["public"]["Enums"]["opportunity_status"]
          times_detected: number
          title: string
          title_normalized: string
          updated_at: string
          urgency_score: number | null
        }
        Insert: {
          audit_id?: string | null
          business_id: string
          business_impact_score?: number | null
          commercial_fit_score?: number | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          customer_need_score?: number | null
          description?: string | null
          estimated_complexity?:
            | Database["public"]["Enums"]["opportunity_complexity"]
            | null
          estimated_value?: number | null
          evidence?: string | null
          evidence_strength_score?: number | null
          expected_benefit?: string | null
          feasibility_score?: number | null
          id?: string
          last_detected_at?: string
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          priority?: Database["public"]["Enums"]["opportunity_priority"]
          problem?: string | null
          proposed_solution?: string | null
          recommended_service?: string | null
          score?: number | null
          score_reasoning?: Json
          source?: string
          status?: Database["public"]["Enums"]["opportunity_status"]
          times_detected?: number
          title: string
          title_normalized: string
          updated_at?: string
          urgency_score?: number | null
        }
        Update: {
          audit_id?: string | null
          business_id?: string
          business_impact_score?: number | null
          commercial_fit_score?: number | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          customer_need_score?: number | null
          description?: string | null
          estimated_complexity?:
            | Database["public"]["Enums"]["opportunity_complexity"]
            | null
          estimated_value?: number | null
          evidence?: string | null
          evidence_strength_score?: number | null
          expected_benefit?: string | null
          feasibility_score?: number | null
          id?: string
          last_detected_at?: string
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          priority?: Database["public"]["Enums"]["opportunity_priority"]
          problem?: string | null
          proposed_solution?: string | null
          recommended_service?: string | null
          score?: number | null
          score_reasoning?: Json
          source?: string
          status?: Database["public"]["Enums"]["opportunity_status"]
          times_detected?: number
          title?: string
          title_normalized?: string
          updated_at?: string
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "website_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_drafts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body: string
          business_id: string
          channel: Database["public"]["Enums"]["outreach_channel"]
          contact_id: string | null
          created_at: string
          created_by: string | null
          generated_at: string
          id: string
          is_user_edited: boolean
          message_type: Database["public"]["Enums"]["outreach_message_type"]
          model: string
          opportunity_id: string
          personalization_reasoning: Json
          personalization_score: number | null
          sales_strategy_id: string
          status: Database["public"]["Enums"]["outreach_draft_status"]
          subject: string | null
          updated_at: string
          validation_errors: Json
          validation_status: Database["public"]["Enums"]["validation_status"]
          variant: Database["public"]["Enums"]["outreach_variant"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body: string
          business_id: string
          channel: Database["public"]["Enums"]["outreach_channel"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          generated_at?: string
          id?: string
          is_user_edited?: boolean
          message_type?: Database["public"]["Enums"]["outreach_message_type"]
          model: string
          opportunity_id: string
          personalization_reasoning?: Json
          personalization_score?: number | null
          sales_strategy_id: string
          status?: Database["public"]["Enums"]["outreach_draft_status"]
          subject?: string | null
          updated_at?: string
          validation_errors?: Json
          validation_status: Database["public"]["Enums"]["validation_status"]
          variant: Database["public"]["Enums"]["outreach_variant"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          business_id?: string
          channel?: Database["public"]["Enums"]["outreach_channel"]
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          generated_at?: string
          id?: string
          is_user_edited?: boolean
          message_type?: Database["public"]["Enums"]["outreach_message_type"]
          model?: string
          opportunity_id?: string
          personalization_reasoning?: Json
          personalization_score?: number | null
          sales_strategy_id?: string
          status?: Database["public"]["Enums"]["outreach_draft_status"]
          subject?: string | null
          updated_at?: string
          validation_errors?: Json
          validation_status?: Database["public"]["Enums"]["validation_status"]
          variant?: Database["public"]["Enums"]["outreach_variant"]
        }
        Relationships: [
          {
            foreignKeyName: "outreach_drafts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_drafts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_drafts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_drafts_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_drafts_sales_strategy_id_fkey"
            columns: ["sales_strategy_id"]
            isOneToOne: false
            referencedRelation: "sales_strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_send_attempts: {
        Row: {
          attempted_at: string
          business_id: string
          channel: Database["public"]["Enums"]["outreach_channel"]
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          error_message: string | null
          id: string
          message_body: string
          message_subject: string | null
          metadata: Json
          outreach_draft_id: string
          provider: string
          provider_message_id: string | null
          recipient_address: string
          retryable: boolean | null
          sender_identity: string
          status: Database["public"]["Enums"]["send_attempt_status"]
          updated_at: string
        }
        Insert: {
          attempted_at?: string
          business_id: string
          channel: Database["public"]["Enums"]["outreach_channel"]
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_body: string
          message_subject?: string | null
          metadata?: Json
          outreach_draft_id: string
          provider: string
          provider_message_id?: string | null
          recipient_address: string
          retryable?: boolean | null
          sender_identity: string
          status?: Database["public"]["Enums"]["send_attempt_status"]
          updated_at?: string
        }
        Update: {
          attempted_at?: string
          business_id?: string
          channel?: Database["public"]["Enums"]["outreach_channel"]
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_body?: string
          message_subject?: string | null
          metadata?: Json
          outreach_draft_id?: string
          provider?: string
          provider_message_id?: string | null
          recipient_address?: string
          retryable?: boolean | null
          sender_identity?: string
          status?: Database["public"]["Enums"]["send_attempt_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_send_attempts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_send_attempts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_send_attempts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_send_attempts_outreach_draft_id_fkey"
            columns: ["outreach_draft_id"]
            isOneToOne: false
            referencedRelation: "outreach_drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          type: Database["public"]["Enums"]["product_type"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          type: Database["public"]["Enums"]["product_type"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          type?: Database["public"]["Enums"]["product_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales_strategies: {
        Row: {
          business_id: string
          confidence: number | null
          contact_reason: string
          created_at: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          expected_business_benefit: string
          generated_at: string
          generated_by: string | null
          id: string
          model: string
          objection_considerations: Json
          opening_strategy: string
          opportunity_id: string
          primary_problem: string
          priority: Database["public"]["Enums"]["opportunity_priority"]
          recommended_channel: Database["public"]["Enums"]["recommended_channel"]
          recommended_service: string
          recommended_solution: string
          sales_angle: string
          status: Database["public"]["Enums"]["sales_strategy_status"]
          supporting_evidence: string
          target_contact_id: string | null
          things_to_avoid: Json
          updated_at: string
          value_proposition: string
          why_it_matters: string
        }
        Insert: {
          business_id: string
          confidence?: number | null
          contact_reason: string
          created_at?: string
          evidence_type: Database["public"]["Enums"]["evidence_type"]
          expected_business_benefit: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          model: string
          objection_considerations?: Json
          opening_strategy: string
          opportunity_id: string
          primary_problem: string
          priority: Database["public"]["Enums"]["opportunity_priority"]
          recommended_channel: Database["public"]["Enums"]["recommended_channel"]
          recommended_service: string
          recommended_solution: string
          sales_angle: string
          status?: Database["public"]["Enums"]["sales_strategy_status"]
          supporting_evidence: string
          target_contact_id?: string | null
          things_to_avoid?: Json
          updated_at?: string
          value_proposition: string
          why_it_matters: string
        }
        Update: {
          business_id?: string
          confidence?: number | null
          contact_reason?: string
          created_at?: string
          evidence_type?: Database["public"]["Enums"]["evidence_type"]
          expected_business_benefit?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          model?: string
          objection_considerations?: Json
          opening_strategy?: string
          opportunity_id?: string
          primary_problem?: string
          priority?: Database["public"]["Enums"]["opportunity_priority"]
          recommended_channel?: Database["public"]["Enums"]["recommended_channel"]
          recommended_service?: string
          recommended_solution?: string
          sales_angle?: string
          status?: Database["public"]["Enums"]["sales_strategy_status"]
          supporting_evidence?: string
          target_contact_id?: string | null
          things_to_avoid?: Json
          updated_at?: string
          value_proposition?: string
          why_it_matters?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_strategies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_strategies_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_strategies_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_strategies_target_contact_id_fkey"
            columns: ["target_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      website_audits: {
        Row: {
          access_notes: string | null
          accessibility_score: number | null
          audit_status: Database["public"]["Enums"]["audit_status"]
          audited_at: string
          audited_by: string | null
          business_id: string
          confidence: number | null
          content_score: number | null
          conversion_score: number | null
          created_at: string
          functionality_score: number | null
          id: string
          inferred_issues: Json
          mobile_score: number | null
          model: string
          observed_issues: Json
          overall_score: number | null
          recommendations: Json
          seo_score: number | null
          source_urls: Json
          strengths: Json
          technical_score: number | null
          updated_at: string
          ux_score: number | null
          website_url: string | null
        }
        Insert: {
          access_notes?: string | null
          accessibility_score?: number | null
          audit_status: Database["public"]["Enums"]["audit_status"]
          audited_at?: string
          audited_by?: string | null
          business_id: string
          confidence?: number | null
          content_score?: number | null
          conversion_score?: number | null
          created_at?: string
          functionality_score?: number | null
          id?: string
          inferred_issues?: Json
          mobile_score?: number | null
          model: string
          observed_issues?: Json
          overall_score?: number | null
          recommendations?: Json
          seo_score?: number | null
          source_urls?: Json
          strengths?: Json
          technical_score?: number | null
          updated_at?: string
          ux_score?: number | null
          website_url?: string | null
        }
        Update: {
          access_notes?: string | null
          accessibility_score?: number | null
          audit_status?: Database["public"]["Enums"]["audit_status"]
          audited_at?: string
          audited_by?: string | null
          business_id?: string
          confidence?: number | null
          content_score?: number | null
          conversion_score?: number | null
          created_at?: string
          functionality_score?: number | null
          id?: string
          inferred_issues?: Json
          mobile_score?: number | null
          model?: string
          observed_issues?: Json
          overall_score?: number | null
          recommendations?: Json
          seo_score?: number | null
          source_urls?: Json
          strengths?: Json
          technical_score?: number | null
          updated_at?: string
          ux_score?: number | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "website_audits_audited_by_fkey"
            columns: ["audited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "website_audits_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      audit_category:
        | "TECHNICAL"
        | "MOBILE"
        | "UX"
        | "ACCESSIBILITY"
        | "SEO"
        | "CONTENT"
        | "CONVERSION"
        | "FUNCTIONALITY"
      audit_status:
        | "COMPLETED"
        | "NO_WEBSITE"
        | "UNREACHABLE"
        | "INVALID_URL"
        | "FAILED"
      campaign_status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED"
      campaign_type:
        | "CLIENT_ACQUISITION"
        | "USER_ACQUISITION"
        | "SIGNATURE_COLLECTION"
        | "BRAND_AWARENESS"
        | "CONTENT"
        | "PARTNERSHIP"
        | "REFERRAL"
      contact_verification_status: "VERIFIED" | "UNVERIFIED" | "UNKNOWN"
      evidence_type: "OBSERVED" | "INFERRED"
      lead_classification:
        | "EXCEPTIONAL"
        | "HIGH"
        | "MEDIUM"
        | "LOW"
        | "VERY_LOW"
      opportunity_complexity: "LOW" | "MEDIUM" | "HIGH"
      opportunity_priority: "HIGH" | "MEDIUM" | "LOW" | "CRITICAL"
      opportunity_status:
        | "IDENTIFIED"
        | "QUALIFIED"
        | "PRESENTED"
        | "ACCEPTED"
        | "REJECTED"
        | "CLOSED"
      opportunity_type:
        | "WEBSITE_REDESIGN"
        | "WEBSITE_DEVELOPMENT"
        | "MOBILE_APP"
        | "BOOKING_SYSTEM"
        | "ECOMMERCE"
        | "CUSTOMER_PORTAL"
        | "UI_UX_REDESIGN"
        | "AUTOMATION"
        | "AI_INTEGRATION"
        | "DASHBOARD"
        | "CUSTOM_SOFTWARE"
        | "OTHER"
      outreach_channel: "WHATSAPP" | "EMAIL"
      outreach_draft_status:
        | "DRAFT"
        | "NEEDS_REVIEW"
        | "APPROVED"
        | "READY_TO_SEND"
        | "SENT"
        | "CANCELLED"
        | "SENDING"
        | "FAILED"
      outreach_message_type: "INITIAL_OUTREACH"
      outreach_variant: "RECOMMENDED" | "DIRECT" | "CONVERSATIONAL"
      pipeline_status:
        | "NEW"
        | "QUALIFIED"
        | "CONTACTED"
        | "REPLIED"
        | "MEETING"
        | "PROPOSAL"
        | "WON"
        | "LOST"
      product_type: "ZVIKO_LABS" | "DATING_APP"
      recommended_channel: "WHATSAPP" | "EMAIL" | "NONE"
      sales_strategy_status: "ACTIVE" | "SUPERSEDED"
      send_attempt_status: "PENDING" | "SENT" | "FAILED"
      validation_status: "PASSED" | "FAILED"
      whatsapp_status: "AVAILABLE" | "NOT_AVAILABLE" | "UNKNOWN"
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
      audit_category: [
        "TECHNICAL",
        "MOBILE",
        "UX",
        "ACCESSIBILITY",
        "SEO",
        "CONTENT",
        "CONVERSION",
        "FUNCTIONALITY",
      ],
      audit_status: [
        "COMPLETED",
        "NO_WEBSITE",
        "UNREACHABLE",
        "INVALID_URL",
        "FAILED",
      ],
      campaign_status: ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"],
      campaign_type: [
        "CLIENT_ACQUISITION",
        "USER_ACQUISITION",
        "SIGNATURE_COLLECTION",
        "BRAND_AWARENESS",
        "CONTENT",
        "PARTNERSHIP",
        "REFERRAL",
      ],
      contact_verification_status: ["VERIFIED", "UNVERIFIED", "UNKNOWN"],
      evidence_type: ["OBSERVED", "INFERRED"],
      lead_classification: ["EXCEPTIONAL", "HIGH", "MEDIUM", "LOW", "VERY_LOW"],
      opportunity_complexity: ["LOW", "MEDIUM", "HIGH"],
      opportunity_priority: ["HIGH", "MEDIUM", "LOW", "CRITICAL"],
      opportunity_status: [
        "IDENTIFIED",
        "QUALIFIED",
        "PRESENTED",
        "ACCEPTED",
        "REJECTED",
        "CLOSED",
      ],
      opportunity_type: [
        "WEBSITE_REDESIGN",
        "WEBSITE_DEVELOPMENT",
        "MOBILE_APP",
        "BOOKING_SYSTEM",
        "ECOMMERCE",
        "CUSTOMER_PORTAL",
        "UI_UX_REDESIGN",
        "AUTOMATION",
        "AI_INTEGRATION",
        "DASHBOARD",
        "CUSTOM_SOFTWARE",
        "OTHER",
      ],
      outreach_channel: ["WHATSAPP", "EMAIL"],
      outreach_draft_status: [
        "DRAFT",
        "NEEDS_REVIEW",
        "APPROVED",
        "READY_TO_SEND",
        "SENT",
        "CANCELLED",
        "SENDING",
        "FAILED",
      ],
      outreach_message_type: ["INITIAL_OUTREACH"],
      outreach_variant: ["RECOMMENDED", "DIRECT", "CONVERSATIONAL"],
      pipeline_status: [
        "NEW",
        "QUALIFIED",
        "CONTACTED",
        "REPLIED",
        "MEETING",
        "PROPOSAL",
        "WON",
        "LOST",
      ],
      product_type: ["ZVIKO_LABS", "DATING_APP"],
      recommended_channel: ["WHATSAPP", "EMAIL", "NONE"],
      sales_strategy_status: ["ACTIVE", "SUPERSEDED"],
      send_attempt_status: ["PENDING", "SENT", "FAILED"],
      validation_status: ["PASSED", "FAILED"],
      whatsapp_status: ["AVAILABLE", "NOT_AVAILABLE", "UNKNOWN"],
    },
  },
} as const
