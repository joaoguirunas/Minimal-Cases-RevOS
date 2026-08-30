/**
 * A/B Testing Types
 * LP PRO™ Phase 4 Task #16
 */

import type { LpPageContent } from '@/hooks/useLpTemplates';

// Test Status
export type ABTestStatus = 'draft' | 'active' | 'paused' | 'concluded';

// Confidence Levels (statistical significance)
export type ConfidenceLevel = 90 | 95 | 99;

/**
 * A/B Test Campaign
 * Represents a complete test with multiple variants
 */
export interface LpABTest {
  id: string;
  page_id: string;
  name: string;
  description?: string;
  status: ABTestStatus;
  hypothesis?: string;

  // Traffic
  traffic_percent: number; // 0-100, % of visitors to include

  // Dates
  started_at?: string;
  ended_at?: string;

  // Statistics
  confidence_level: 90 | 95 | 99;
  min_sample_size: number;

  created_at: string;
  updated_at: string;
  created_by: string;
}

/**
 * Page Variant
 * One version of the page in the test
 */
export interface LpABVariant {
  id: string;
  test_id: string;
  name: string; // "Control", "Variant B", etc.
  content: LpPageContent;
  traffic_weight: number; // Relative weight (default 100)
  is_control: boolean; // The original/control version
  created_at: string;
}

/**
 * Visitor Session in A/B Test
 * Tracks which variant a visitor saw
 */
export interface LpABSession {
  id: string;
  page_id: string;
  test_id?: string;
  variant_id?: string;
  visitor_id: string; // Anonymous identifier

  // Metadata
  user_agent?: string;
  ip_address?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;

  started_at: string;
  last_activity_at: string;
}

/**
 * Conversion Event
 * Form submission, CTA click, etc.
 */
export interface LpABConversion {
  id: string;
  session_id: string;
  test_id: string;
  variant_id: string;
  event_type: 'form_submit' | 'cta_click' | 'custom';
  event_data?: Record<string, unknown>;
  created_at: string;
}

/**
 * Variant Performance Statistics
 */
export interface VariantStats {
  variant_id: string;
  variant_name: string;
  visitors: number;
  conversions: number;
  conversion_rate: number; // Percentage (0-100)
  is_control: boolean;
  is_winner?: boolean; // Statistically significant winner
  lift?: number; // % improvement vs control
  confidence?: number; // Confidence in result (%)
}

/**
 * A/B Test Results Summary
 */
export interface ABTestResults {
  test_id: string;
  test_name: string;
  status: ABTestStatus;
  started_at: string;
  ended_at?: string;

  // Results
  total_visitors: number;
  total_conversions: number;
  overall_conversion_rate: number;

  // Per-variant
  variants: VariantStats[];

  // Statistical analysis
  winner_id?: string;
  is_statistically_significant: boolean;
  confidence_level: number;
  p_value?: number;
  sample_size_achieved: boolean;

  // Recommendation
  recommendation: 'continue' | 'declare_winner' | 'inconclusive';
}

/**
 * Request to create A/B Test
 */
export interface CreateABTestRequest {
  page_id: string;
  name: string;
  description?: string;
  hypothesis?: string;
  traffic_percent?: number; // Default 100
  confidence_level?: ConfidenceLevel; // Default 95
  min_sample_size?: number; // Default 100
}

/**
 * Request to create variant
 */
export interface CreateVariantRequest {
  test_id: string;
  name: string;
  content: LpPageContent;
  traffic_weight?: number; // Default 100
  is_control?: boolean;
}

/**
 * Request to track visitor session
 */
export interface TrackSessionRequest {
  page_id: string;
  test_id?: string;
  visitor_id: string;
  referrer?: string;
  utm_params?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
}

/**
 * Request to track conversion
 */
export interface TrackConversionRequest {
  session_id: string;
  test_id: string;
  variant_id: string;
  event_type: 'form_submit' | 'cta_click' | 'custom';
  event_data?: Record<string, unknown>;
}
