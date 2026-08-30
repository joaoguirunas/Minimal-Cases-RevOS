/**
 * Analytics Types
 * LP PRO™ Phase 4 Task #17
 */

// Page view/analytics record
export interface LpPageAnalytics {
  id: string;
  page_id: string;
  visitor_id: string;
  session_id: string;

  // Metadata
  user_agent?: string;
  ip_address?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;

  // Device
  device_type?: 'desktop' | 'mobile' | 'tablet';
  device_os?: string;
  browser?: string;

  // Engagement
  time_on_page?: number; // seconds
  scroll_depth?: number; // 0-100

  viewed_at: string;
  left_at?: string;
}

// Form submission
export interface LpFormSubmission {
  id: string;
  page_id: string;
  form_id?: string;
  visitor_id: string;
  session_id: string;

  form_data: Record<string, unknown>;
  contact_id?: string;
  lead_id?: string;

  status: 'submitted' | 'processing' | 'success' | 'failed';
  error_message?: string;

  submitted_at: string;
}

// CTA event
export interface LpCtaEvent {
  id: string;
  page_id: string;
  visitor_id: string;
  session_id: string;

  event_type: 'button_click' | 'link_click' | 'phone_call' | 'email';
  cta_text?: string;
  cta_url?: string;

  block_id?: string;
  position_y?: number;

  created_at: string;
}

// Daily summary
export interface LpAnalyticsDaily {
  id: string;
  page_id: string;
  date: string;

  // Traffic
  total_visits: number;
  unique_visitors: number;
  avg_time_on_page: number;
  avg_scroll_depth: number;

  // Device breakdown
  mobile_visits: number;
  desktop_visits: number;
  tablet_visits: number;

  // Conversions
  form_submissions: number;
  form_submission_rate: number;
  cta_clicks: number;

  // Sources
  direct_visits: number;
  organic_visits: number;
  referral_visits: number;
  paid_visits: number;

  created_at: string;
  updated_at: string;
}

// Page summary
export interface LpPageSummary {
  total_visits: number;
  unique_visitors: number;
  form_submissions: number;
  submission_rate: number;
  avg_time_on_page: number;
  avg_scroll_depth: number;
  mobile_percentage: number;
  top_referrer?: string;
  top_utm_source?: string;
}

// Analytics report
export interface LpAnalyticsReport {
  page_id: string;
  page_name: string;
  period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  summary: LpPageSummary;
  daily_data: LpAnalyticsDaily[];
  traffic_sources: Array<{
    source: string;
    visits: number;
    submission_rate: number;
  }>;
  device_breakdown: Array<{
    device: string;
    visits: number;
    percentage: number;
  }>;
  top_referrers: Array<{
    referrer: string;
    visits: number;
  }>;
}

// Request to track page view
export interface TrackPageViewRequest {
  page_id: string;
  visitor_id: string;
  session_id: string;
  referrer?: string;
  utm_params?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  device?: {
    type: 'desktop' | 'mobile' | 'tablet';
    os?: string;
    browser?: string;
  };
}

// Request to track form submission
export interface TrackFormSubmissionRequest {
  page_id: string;
  form_id?: string;
  visitor_id: string;
  session_id: string;
  form_data: Record<string, unknown>;
}

// Request to track CTA click
export interface TrackCtaEventRequest {
  page_id: string;
  visitor_id: string;
  session_id: string;
  event_type: 'button_click' | 'link_click' | 'phone_call' | 'email';
  cta_text?: string;
  cta_url?: string;
  block_id?: string;
}
