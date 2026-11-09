export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type CreatorMode = "creator" | "affiliate" | "business" | "personal_brand";
export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer" | "member";
export type OnboardingSessionStatus = "in_progress" | "adaptive_interview" | "completed";
export type NicheConfidenceLevel = "high" | "medium" | "exploratory";
export type ResearchReportType = "trend" | "competitor" | "audience";
export type ResearchConfidenceLevel = "high" | "medium" | "low";
export type ResearchSourceOrigin =
  | "web_grounding"
  | "rss_feed"
  | "user_url"
  | "competitor_evidence";
export type SocialPlatformId =
  | "tiktok"
  | "instagram"
  | "youtube"
  | "linkedin"
  | "threads"
  | "x";
export type PillarObjective = "educate" | "trust" | "engage" | "convert";
export type ContentIdeaAngle =
  | "curiosity"
  | "contrarian"
  | "tutorial"
  | "case_study"
  | "story"
  | "myth_busting";
export type ContentIdeaStatus =
  | "backlog"
  | "shortlisted"
  | "in_production"
  | "completed"
  | "archived";
export type ContentItemStage =
  | "draft"
  | "scripting"
  | "ready_for_production"
  | "ready_to_publish"
  | "published"
  | "archived";
export type ScriptFramework = "AIDA" | "PAS" | "BAB" | "Story" | "Listicle";
export type MediaAssetType =
  | "image"
  | "thumbnail"
  | "brand_visual"
  | "voiceover"
  | "video_clip"
  | "exported_video"
  | "subtitle";
export type GenerationJobType =
  | "image_generation"
  | "voice_generation"
  | "video_generation"
  | "timeline_export"
  | "subtitle_generation";
export type GenerationJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";
export type VideoAspectRatio = "9:16" | "16:9" | "1:1" | "4:5";
export type VideoResolution = "720p" | "1080p" | "4k";

export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowStepStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type WorkflowLogLevel = "info" | "warn" | "error" | "debug";

export type WorkflowType =
  | "workflow_a_research_to_storyboard"
  | "workflow_b_affiliate_pipeline"
  | "workflow_c_analytics_optimization"
  | "custom";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          preferred_language: string;
          theme_preference: string;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          avatar_url?: string | null;
          preferred_language?: string;
          theme_preference?: string;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          preferred_language?: string;
          theme_preference?: string;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          creator_mode: CreatorMode;
          logo_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          creator_mode?: CreatorMode;
          logo_url?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          creator_mode?: CreatorMode;
          logo_url?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: WorkspaceRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string;
          role?: WorkspaceRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workspace_settings: {
        Row: {
          id: string;
          workspace_id: string;
          default_language: string;
          default_ai_model: string;
          enable_auto_hashtag: boolean;
          notify_on_publish: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          default_language?: string;
          default_ai_model?: string;
          enable_auto_hashtag?: boolean;
          notify_on_publish?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          default_language?: string;
          default_ai_model?: string;
          enable_auto_hashtag?: boolean;
          notify_on_publish?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      onboarding_sessions: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          status: OnboardingSessionStatus;
          current_step: number;
          core_answers: Json;
          adaptive_questions: Json;
          adaptive_answers: Json;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          status?: OnboardingSessionStatus;
          current_step?: number;
          core_answers?: Json;
          adaptive_questions?: Json;
          adaptive_answers?: Json;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string | null;
          status?: OnboardingSessionStatus;
          current_step?: number;
          core_answers?: Json;
          adaptive_questions?: Json;
          adaptive_answers?: Json;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      creator_profiles: {
        Row: {
          id: string;
          workspace_id: string;
          creator_name: string;
          primary_niche: string;
          secondary_niches: string[];
          unique_value_proposition: string;
          target_audience_summary: string | null;
          audience_persona: Json;
          tone_of_voice: string[];
          personality_archetype: string | null;
          strengths: string[];
          taboo_topics: string[];
          primary_platforms: string[];
          preferred_formats: string[];
          assessment_scores: Json;
          monetization_recommendations: Json;
          roadmap_30_days: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          creator_name: string;
          primary_niche: string;
          secondary_niches?: string[];
          unique_value_proposition?: string;
          target_audience_summary?: string | null;
          audience_persona?: Json;
          tone_of_voice?: string[];
          personality_archetype?: string | null;
          strengths?: string[];
          taboo_topics?: string[];
          primary_platforms?: string[];
          preferred_formats?: string[];
          assessment_scores?: Json;
          monetization_recommendations?: Json;
          roadmap_30_days?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          creator_name?: string;
          primary_niche?: string;
          secondary_niches?: string[];
          unique_value_proposition?: string;
          target_audience_summary?: string | null;
          audience_persona?: Json;
          tone_of_voice?: string[];
          personality_archetype?: string | null;
          strengths?: string[];
          taboo_topics?: string[];
          primary_platforms?: string[];
          preferred_formats?: string[];
          assessment_scores?: Json;
          monetization_recommendations?: Json;
          roadmap_30_days?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      niche_recommendations: {
        Row: {
          id: string;
          workspace_id: string;
          niche_title: string;
          explanation: string;
          audience: string;
          content_opportunities: Json;
          competition_assessment: Json;
          required_skills: string[];
          monetization_possibilities: Json;
          confidence_level: NicheConfidenceLevel;
          confidence_score: number;
          supporting_evidence: Json;
          is_selected: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          niche_title: string;
          explanation: string;
          audience: string;
          content_opportunities?: Json;
          competition_assessment?: Json;
          required_skills?: string[];
          monetization_possibilities?: Json;
          confidence_level: NicheConfidenceLevel;
          confidence_score?: number;
          supporting_evidence?: Json;
          is_selected?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          niche_title?: string;
          explanation?: string;
          audience?: string;
          content_opportunities?: Json;
          competition_assessment?: Json;
          required_skills?: string[];
          monetization_possibilities?: Json;
          confidence_level?: NicheConfidenceLevel;
          confidence_score?: number;
          supporting_evidence?: Json;
          is_selected?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      credit_wallets: {
        Row: {
          id: string;
          workspace_id: string;
          balance: number;
          monthly_allowance: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          balance?: number;
          monthly_allowance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          balance?: number;
          monthly_allowance?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      credit_transactions: {
        Row: {
          id: string;
          wallet_id: string;
          amount: number;
          balance_after: number;
          transaction_type: "monthly_grant" | "top_up" | "ai_generation" | "refund";
          reference_id: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          wallet_id: string;
          amount: number;
          balance_after: number;
          transaction_type: "monthly_grant" | "top_up" | "ai_generation" | "refund";
          reference_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          wallet_id?: string;
          amount?: number;
          balance_after?: number;
          transaction_type?: "monthly_grant" | "top_up" | "ai_generation" | "refund";
          reference_id?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      agent_runs: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          agent_name: string;
          session_id: string | null;
          input_payload: Json;
          output_payload: Json | null;
          status: "running" | "completed" | "failed" | "cancelled";
          error_details: string | null;
          total_tokens_used: number;
          cost_usd: number;
          started_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          agent_name: string;
          session_id?: string | null;
          input_payload?: Json;
          output_payload?: Json | null;
          status?: "running" | "completed" | "failed" | "cancelled";
          error_details?: string | null;
          total_tokens_used?: number;
          cost_usd?: number;
          started_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string | null;
          agent_name?: string;
          session_id?: string | null;
          input_payload?: Json;
          output_payload?: Json | null;
          status?: "running" | "completed" | "failed" | "cancelled";
          error_details?: string | null;
          total_tokens_used?: number;
          cost_usd?: number;
          started_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      ai_provider_usage: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          agent_run_id: string | null;
          provider: string;
          model_id: string;
          operation_type: string;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          cost_usd: number;
          credits_charged: number;
          duration_ms: number;
          status: "success" | "failed" | "fallback_success";
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id?: string | null;
          agent_run_id?: string | null;
          provider: string;
          model_id: string;
          operation_type: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          cost_usd?: number;
          credits_charged?: number;
          duration_ms?: number;
          status?: "success" | "failed" | "fallback_success";
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          user_id?: string | null;
          agent_run_id?: string | null;
          provider?: string;
          model_id?: string;
          operation_type?: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          cost_usd?: number;
          credits_charged?: number;
          duration_ms?: number;
          status?: "success" | "failed" | "fallback_success";
          created_at?: string;
        };
        Relationships: [];
      };
      brand_profiles: {
        Row: {
          id: string;
          workspace_id: string;
          brand_name: string;
          tagline: string;
          positioning_statement: string;
          offer_summary: string;
          brand_values: string[];
          voice_guidelines: string[];
          color_palette: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          brand_name: string;
          tagline?: string;
          positioning_statement?: string;
          offer_summary?: string;
          brand_values?: string[];
          voice_guidelines?: string[];
          color_palette?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          brand_name?: string;
          tagline?: string;
          positioning_statement?: string;
          offer_summary?: string;
          brand_values?: string[];
          voice_guidelines?: string[];
          color_palette?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      research_reports: {
        Row: {
          id: string;
          workspace_id: string;
          report_type: ResearchReportType;
          title: string;
          topic_query: string;
          target_platform: string;
          summary: string;
          verified_facts: Json;
          ai_interpretations: Json;
          trend_claims: Json;
          audience_insights: Json;
          competitor_insights: Json;
          actionable_recommendations: Json;
          data_limitations: string;
          overall_confidence: ResearchConfidenceLevel;
          realtime_data_available: boolean;
          realtime_unavailable_reason: string | null;
          retrieved_at: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          report_type: ResearchReportType;
          title: string;
          topic_query: string;
          target_platform?: string;
          summary: string;
          verified_facts?: Json;
          ai_interpretations?: Json;
          trend_claims?: Json;
          audience_insights?: Json;
          competitor_insights?: Json;
          actionable_recommendations?: Json;
          data_limitations: string;
          overall_confidence: ResearchConfidenceLevel;
          realtime_data_available?: boolean;
          realtime_unavailable_reason?: string | null;
          retrieved_at?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          report_type?: ResearchReportType;
          title?: string;
          topic_query?: string;
          target_platform?: string;
          summary?: string;
          verified_facts?: Json;
          ai_interpretations?: Json;
          trend_claims?: Json;
          audience_insights?: Json;
          competitor_insights?: Json;
          actionable_recommendations?: Json;
          data_limitations?: string;
          overall_confidence?: ResearchConfidenceLevel;
          realtime_data_available?: boolean;
          realtime_unavailable_reason?: string | null;
          retrieved_at?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      research_sources: {
        Row: {
          id: string;
          report_id: string;
          workspace_id: string;
          source_url: string;
          source_title: string;
          retrieved_at: string;
          relevant_extract: string;
          data_limitations: string;
          confidence_level: ResearchConfidenceLevel;
          confidence_rationale: string;
          source_origin: ResearchSourceOrigin;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id: string;
          workspace_id: string;
          source_url: string;
          source_title: string;
          retrieved_at: string;
          relevant_extract: string;
          data_limitations: string;
          confidence_level: ResearchConfidenceLevel;
          confidence_rationale: string;
          source_origin?: ResearchSourceOrigin;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string;
          workspace_id?: string;
          source_url?: string;
          source_title?: string;
          retrieved_at?: string;
          relevant_extract?: string;
          data_limitations?: string;
          confidence_level?: ResearchConfidenceLevel;
          confidence_rationale?: string;
          source_origin?: ResearchSourceOrigin;
          created_at?: string;
        };
        Relationships: [];
      };
      competitor_profiles: {
        Row: {
          id: string;
          workspace_id: string;
          handle: string;
          display_name: string;
          platform: SocialPlatformId;
          profile_url: string | null;
          follower_count_estimate: number | null;
          positioning_summary: string;
          observed_hooks: Json;
          top_performing_topics: string[];
          content_gaps: string[];
          evidence_notes: string;
          data_limitations: string;
          last_observed_at: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          handle: string;
          display_name?: string;
          platform: SocialPlatformId;
          profile_url?: string | null;
          follower_count_estimate?: number | null;
          positioning_summary?: string;
          observed_hooks?: Json;
          top_performing_topics?: string[];
          content_gaps?: string[];
          evidence_notes?: string;
          data_limitations?: string;
          last_observed_at?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          handle?: string;
          display_name?: string;
          platform?: SocialPlatformId;
          profile_url?: string | null;
          follower_count_estimate?: number | null;
          positioning_summary?: string;
          observed_hooks?: Json;
          top_performing_topics?: string[];
          content_gaps?: string[];
          evidence_notes?: string;
          data_limitations?: string;
          last_observed_at?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_strategies: {
        Row: {
          id: string;
          workspace_id: string;
          research_report_id: string | null;
          title: string;
          positioning_statement: string;
          unique_differentiator: string;
          core_narrative: string;
          platform_distribution: Json;
          opportunity_scores: Json;
          publishing_frequency_per_week: number;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          research_report_id?: string | null;
          title: string;
          positioning_statement: string;
          unique_differentiator?: string;
          core_narrative?: string;
          platform_distribution?: Json;
          opportunity_scores?: Json;
          publishing_frequency_per_week?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          research_report_id?: string | null;
          title?: string;
          positioning_statement?: string;
          unique_differentiator?: string;
          core_narrative?: string;
          platform_distribution?: Json;
          opportunity_scores?: Json;
          publishing_frequency_per_week?: number;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_pillars: {
        Row: {
          id: string;
          strategy_id: string;
          workspace_id: string;
          name: string;
          description: string;
          objective: PillarObjective;
          ratio_percentage: number;
          example_topics: string[];
          recommended_formats: string[];
          color_code: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          strategy_id: string;
          workspace_id: string;
          name: string;
          description?: string;
          objective?: PillarObjective;
          ratio_percentage?: number;
          example_topics?: string[];
          recommended_formats?: string[];
          color_code?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          strategy_id?: string;
          workspace_id?: string;
          name?: string;
          description?: string;
          objective?: PillarObjective;
          ratio_percentage?: number;
          example_topics?: string[];
          recommended_formats?: string[];
          color_code?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_ideas: {
        Row: {
          id: string;
          workspace_id: string;
          pillar_id: string | null;
          research_report_id: string | null;
          title: string;
          hook_concept: string;
          angle_type: ContentIdeaAngle;
          target_platform: SocialPlatformId;
          opportunity_score: number;
          opportunity_rationale: string;
          research_trace: string;
          status: ContentIdeaStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          pillar_id?: string | null;
          research_report_id?: string | null;
          title: string;
          hook_concept: string;
          angle_type?: ContentIdeaAngle;
          target_platform?: SocialPlatformId;
          opportunity_score?: number;
          opportunity_rationale?: string;
          research_trace?: string;
          status?: ContentIdeaStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          pillar_id?: string | null;
          research_report_id?: string | null;
          title?: string;
          hook_concept?: string;
          angle_type?: ContentIdeaAngle;
          target_platform?: SocialPlatformId;
          opportunity_score?: number;
          opportunity_rationale?: string;
          research_trace?: string;
          status?: ContentIdeaStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      content_items: {
        Row: {
          id: string;
          workspace_id: string;
          pillar_id: string | null;
          idea_id: string | null;
          research_report_id: string | null;
          source_content_item_id: string | null;
          title: string;
          primary_platform: SocialPlatformId;
          target_platforms: string[];
          content_format: string;
          stage: ContentItemStage;
          hook_variants: Json;
          caption: string;
          call_to_action: string;
          cta_variants: Json;
          hashtags: string[];
          hashtag_tiers: Json;
          platform_adaptation_notes: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          pillar_id?: string | null;
          idea_id?: string | null;
          research_report_id?: string | null;
          source_content_item_id?: string | null;
          title: string;
          primary_platform?: SocialPlatformId;
          target_platforms?: string[];
          content_format?: string;
          stage?: ContentItemStage;
          hook_variants?: Json;
          caption?: string;
          call_to_action?: string;
          cta_variants?: Json;
          hashtags?: string[];
          hashtag_tiers?: Json;
          platform_adaptation_notes?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          pillar_id?: string | null;
          idea_id?: string | null;
          research_report_id?: string | null;
          source_content_item_id?: string | null;
          title?: string;
          primary_platform?: SocialPlatformId;
          target_platforms?: string[];
          content_format?: string;
          stage?: ContentItemStage;
          hook_variants?: Json;
          caption?: string;
          call_to_action?: string;
          cta_variants?: Json;
          hashtags?: string[];
          hashtag_tiers?: Json;
          platform_adaptation_notes?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      scripts: {
        Row: {
          id: string;
          content_item_id: string;
          workspace_id: string;
          version: number;
          target_platform: SocialPlatformId;
          framework: ScriptFramework;
          opening_hook: string;
          body_content: string;
          closing_cta: string;
          visual_and_audio_cues: Json;
          estimated_duration_seconds: number;
          is_current: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          content_item_id: string;
          workspace_id: string;
          version?: number;
          target_platform?: SocialPlatformId;
          framework?: ScriptFramework;
          opening_hook: string;
          body_content: string;
          closing_cta: string;
          visual_and_audio_cues?: Json;
          estimated_duration_seconds?: number;
          is_current?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          content_item_id?: string;
          workspace_id?: string;
          version?: number;
          target_platform?: SocialPlatformId;
          framework?: ScriptFramework;
          opening_hook?: string;
          body_content?: string;
          closing_cta?: string;
          visual_and_audio_cues?: Json;
          estimated_duration_seconds?: number;
          is_current?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      storyboards: {
        Row: {
          id: string;
          workspace_id: string;
          content_item_id: string | null;
          title: string;
          visual_theme: string;
          scenes: Json;
          total_duration_seconds: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          content_item_id?: string | null;
          title: string;
          visual_theme?: string;
          scenes?: Json;
          total_duration_seconds?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          content_item_id?: string | null;
          title?: string;
          visual_theme?: string;
          scenes?: Json;
          total_duration_seconds?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      media_assets: {
        Row: {
          id: string;
          workspace_id: string;
          content_item_id: string | null;
          storyboard_id: string | null;
          asset_type: MediaAssetType;
          title: string;
          storage_path: string;
          public_url: string;
          mime_type: string;
          file_size_bytes: number;
          duration_seconds: number | null;
          dimensions: Json;
          metadata: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          content_item_id?: string | null;
          storyboard_id?: string | null;
          asset_type: MediaAssetType;
          title: string;
          storage_path: string;
          public_url: string;
          mime_type: string;
          file_size_bytes?: number;
          duration_seconds?: number | null;
          dimensions?: Json;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          content_item_id?: string | null;
          storyboard_id?: string | null;
          asset_type?: MediaAssetType;
          title?: string;
          storage_path?: string;
          public_url?: string;
          mime_type?: string;
          file_size_bytes?: number;
          duration_seconds?: number | null;
          dimensions?: Json;
          metadata?: Json;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      generation_jobs: {
        Row: {
          id: string;
          workspace_id: string;
          job_type: GenerationJobType;
          status: GenerationJobStatus;
          progress_percent: number;
          input_payload: Json;
          output_payload: Json;
          error_message: string | null;
          attempts: number;
          max_attempts: number;
          provider: string;
          credits_cost: number;
          ai_usage_id: string | null;
          agent_run_id: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          job_type: GenerationJobType;
          status?: GenerationJobStatus;
          progress_percent?: number;
          input_payload?: Json;
          output_payload?: Json;
          error_message?: string | null;
          attempts?: number;
          max_attempts?: number;
          provider: string;
          credits_cost?: number;
          ai_usage_id?: string | null;
          agent_run_id?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          job_type?: GenerationJobType;
          status?: GenerationJobStatus;
          progress_percent?: number;
          input_payload?: Json;
          output_payload?: Json;
          error_message?: string | null;
          attempts?: number;
          max_attempts?: number;
          provider?: string;
          credits_cost?: number;
          ai_usage_id?: string | null;
          agent_run_id?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      video_projects: {
        Row: {
          id: string;
          workspace_id: string;
          content_item_id: string | null;
          storyboard_id: string | null;
          title: string;
          aspect_ratio: VideoAspectRatio;
          resolution: VideoResolution;
          fps: number;
          timeline_data: Json;
          latest_export_asset_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          content_item_id?: string | null;
          storyboard_id?: string | null;
          title: string;
          aspect_ratio?: VideoAspectRatio;
          resolution?: VideoResolution;
          fps?: number;
          timeline_data?: Json;
          latest_export_asset_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          content_item_id?: string | null;
          storyboard_id?: string | null;
          title?: string;
          aspect_ratio?: VideoAspectRatio;
          resolution?: VideoResolution;
          fps?: number;
          timeline_data?: Json;
          latest_export_asset_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workflow_runs: {
        Row: {
          id: string;
          workspace_id: string;
          workflow_type: WorkflowType;
          title: string;
          status: WorkflowRunStatus;
          current_step_index: number;
          total_steps: number;
          total_tokens_used: number;
          total_cost_usd: number;
          total_credits_deducted: number;
          initial_parameters: Json;
          workflow_context: Json;
          error_message: string | null;
          created_by: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          workflow_type: WorkflowType;
          title: string;
          status?: WorkflowRunStatus;
          current_step_index?: number;
          total_steps: number;
          total_tokens_used?: number;
          total_cost_usd?: number;
          total_credits_deducted?: number;
          initial_parameters?: Json;
          workflow_context?: Json;
          error_message?: string | null;
          created_by?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          workflow_type?: WorkflowType;
          title?: string;
          status?: WorkflowRunStatus;
          current_step_index?: number;
          total_steps?: number;
          total_tokens_used?: number;
          total_cost_usd?: number;
          total_credits_deducted?: number;
          initial_parameters?: Json;
          workflow_context?: Json;
          error_message?: string | null;
          created_by?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workflow_steps: {
        Row: {
          id: string;
          workflow_run_id: string;
          workspace_id: string;
          step_index: number;
          agent_name: string;
          status: WorkflowStepStatus;
          requires_approval: boolean;
          approved_by: string | null;
          approved_at: string | null;
          input_payload: Json;
          output_payload: Json | null;
          error_details: string | null;
          retry_count: number;
          max_retries: number;
          timeout_ms: number;
          tokens_used: number;
          cost_usd: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workflow_run_id: string;
          workspace_id: string;
          step_index: number;
          agent_name: string;
          status?: WorkflowStepStatus;
          requires_approval?: boolean;
          approved_by?: string | null;
          approved_at?: string | null;
          input_payload?: Json;
          output_payload?: Json | null;
          error_details?: string | null;
          retry_count?: number;
          max_retries?: number;
          timeout_ms?: number;
          tokens_used?: number;
          cost_usd?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workflow_run_id?: string;
          workspace_id?: string;
          step_index?: number;
          agent_name?: string;
          status?: WorkflowStepStatus;
          requires_approval?: boolean;
          approved_by?: string | null;
          approved_at?: string | null;
          input_payload?: Json;
          output_payload?: Json | null;
          error_details?: string | null;
          retry_count?: number;
          max_retries?: number;
          timeout_ms?: number;
          tokens_used?: number;
          cost_usd?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      workflow_schedules: {
        Row: {
          id: string;
          workspace_id: string;
          workflow_type: WorkflowType;
          name: string;
          cron_expression: string;
          parameters: Json;
          is_active: boolean;
          max_autonomous_turns: number;
          last_run_at: string | null;
          next_run_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          workflow_type: WorkflowType;
          name: string;
          cron_expression: string;
          parameters?: Json;
          is_active?: boolean;
          max_autonomous_turns?: number;
          last_run_at?: string | null;
          next_run_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          workflow_type?: WorkflowType;
          name?: string;
          cron_expression?: string;
          parameters?: Json;
          is_active?: boolean;
          max_autonomous_turns?: number;
          last_run_at?: string | null;
          next_run_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workflow_logs: {
        Row: {
          id: string;
          workspace_id: string;
          workflow_run_id: string;
          workflow_step_id: string | null;
          agent_name: string;
          log_level: WorkflowLogLevel;
          message: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          workflow_run_id: string;
          workflow_step_id?: string | null;
          agent_name: string;
          log_level: WorkflowLogLevel;
          message: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          workflow_run_id?: string;
          workflow_step_id?: string | null;
          agent_name?: string;
          log_level?: WorkflowLogLevel;
          message?: string;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_workspace_access: {
        Args: {
          ws_id: string;
          minimum_role?: string;
        };
        Returns: boolean;
      };
      is_workspace_creator_during_insert: {
        Args: {
          ws_id: string;
          ws_created_by: string | null;
        };
        Returns: boolean;
      };
      add_workspace_member: {
        Args: {
          target_workspace_id: string;
          member_user_id: string;
          member_role?: WorkspaceRole;
        };
        Returns: string;
      };
      update_workspace_member_role: {
        Args: {
          target_workspace_id: string;
          member_user_id: string;
          new_role: WorkspaceRole;
        };
        Returns: boolean;
      };
      remove_workspace_member: {
        Args: {
          target_workspace_id: string;
          member_user_id: string;
        };
        Returns: boolean;
      };
      transfer_workspace_ownership: {
        Args: {
          target_workspace_id: string;
          new_owner_user_id: string;
        };
        Returns: boolean;
      };
      update_workspace_configuration: {
        Args: {
          target_workspace_id: string;
          new_name: string;
          new_creator_mode: CreatorMode;
          new_default_language?: string;
          new_default_ai_model?: string;
          new_enable_auto_hashtag?: boolean;
          new_notify_on_publish?: boolean;
        };
        Returns: boolean;
      };
      soft_delete_workspace: {
        Args: {
          target_workspace_id: string;
        };
        Returns: boolean;
      };
      record_ai_usage_and_deduct_credits: {
        Args: {
          target_workspace_id: string;
          p_agent_name: string;
          p_operation_type: string;
          p_provider: string;
          p_model_id: string;
          p_prompt_tokens: number;
          p_completion_tokens: number;
          p_total_tokens: number;
          p_cost_usd: number;
          p_credits_to_deduct: number;
          p_duration_ms: number;
          p_status?: string;
          p_input_summary?: Json;
          p_output_summary?: Json | null;
          p_error_details?: string | null;
        };
        Returns: Json;
      };
      select_preferred_niche: {
        Args: {
          target_workspace_id: string;
          target_niche_id: string;
        };
        Returns: string;
      };
      activate_content_strategy: {
        Args: {
          target_workspace_id: string;
          target_strategy_id: string;
        };
        Returns: string;
      };
      save_script_version: {
        Args: {
          target_workspace_id: string;
          target_content_item_id: string;
          p_target_platform: string;
          p_framework: string;
          p_opening_hook: string;
          p_body_content: string;
          p_closing_cta: string;
          p_visual_cues?: Json;
          p_duration_seconds?: number;
        };
        Returns: string;
      };
      save_storyboard: {
        Args: {
          target_workspace_id: string;
          p_title: string;
          p_scenes: Json;
          p_content_item_id?: string | null;
          p_visual_theme?: string;
          p_storyboard_id?: string | null;
        };
        Returns: string;
      };
      save_video_project: {
        Args: {
          target_workspace_id: string;
          p_title: string;
          p_timeline_data: Json;
          p_aspect_ratio?: string;
          p_resolution?: string;
          p_fps?: number;
          p_storyboard_id?: string | null;
          p_content_item_id?: string | null;
          p_project_id?: string | null;
        };
        Returns: string;
      };
      advance_workflow_step: {
        Args: {
          p_run_id: string;
          p_step_index: number;
          p_output: Json;
          p_tokens?: number;
          p_cost?: number;
          p_credits?: number;
        };
        Returns: Json;
      };
      approve_workflow_step: {
        Args: {
          p_run_id: string;
          p_step_index: number;
          p_user_id: string;
        };
        Returns: Json;
      };
      pause_workflow_run: {
        Args: {
          p_run_id: string;
        };
        Returns: Json;
      };
      resume_workflow_run: {
        Args: {
          p_run_id: string;
        };
        Returns: Json;
      };
      cancel_workflow_run: {
        Args: {
          p_run_id: string;
          p_reason?: string;
        };
        Returns: Json;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type WorkspaceMember = Database["public"]["Tables"]["workspace_members"]["Row"];
export type WorkspaceSettings = Database["public"]["Tables"]["workspace_settings"]["Row"];
export type OnboardingSessionRow = Database["public"]["Tables"]["onboarding_sessions"]["Row"];
export type CreatorProfileRow = Database["public"]["Tables"]["creator_profiles"]["Row"];
export type NicheRecommendationRow = Database["public"]["Tables"]["niche_recommendations"]["Row"];
export type CreditWalletRow = Database["public"]["Tables"]["credit_wallets"]["Row"];
export type CreditTransactionRow = Database["public"]["Tables"]["credit_transactions"]["Row"];
export type AgentRunRow = Database["public"]["Tables"]["agent_runs"]["Row"];
export type AiProviderUsageRow = Database["public"]["Tables"]["ai_provider_usage"]["Row"];
export type BrandProfileRow = Database["public"]["Tables"]["brand_profiles"]["Row"];
export type ResearchReportRow = Database["public"]["Tables"]["research_reports"]["Row"];
export type ResearchSourceRow = Database["public"]["Tables"]["research_sources"]["Row"];
export type CompetitorProfileRow = Database["public"]["Tables"]["competitor_profiles"]["Row"];
export type ContentStrategyRow = Database["public"]["Tables"]["content_strategies"]["Row"];
export type ContentPillarRow = Database["public"]["Tables"]["content_pillars"]["Row"];
export type ContentIdeaRow = Database["public"]["Tables"]["content_ideas"]["Row"];
export type ContentItemRow = Database["public"]["Tables"]["content_items"]["Row"];
export type ScriptRow = Database["public"]["Tables"]["scripts"]["Row"];
export type StoryboardRow = Database["public"]["Tables"]["storyboards"]["Row"];
export type MediaAssetRow = Database["public"]["Tables"]["media_assets"]["Row"];
export type GenerationJobRow = Database["public"]["Tables"]["generation_jobs"]["Row"];
export type VideoProjectRow = Database["public"]["Tables"]["video_projects"]["Row"];

export type WorkflowRunRow = Database["public"]["Tables"]["workflow_runs"]["Row"];
export type WorkflowStepRow = Database["public"]["Tables"]["workflow_steps"]["Row"];
export type WorkflowScheduleRow = Database["public"]["Tables"]["workflow_schedules"]["Row"];
export type WorkflowLogRow = Database["public"]["Tables"]["workflow_logs"]["Row"];
