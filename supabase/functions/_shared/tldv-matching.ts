/**
 * tl;dv — Shared matching utilities
 *
 * Encapsulates the algorithm that correlates a tl;dv meeting to an existing
 * RevOS `meetings` row by overlapping attendee emails and a ±90-minute
 * start-time window.
 *
 * Also exports the tl;dv API client factory and common types.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TldvInvitee {
  name: string;
  email: string;
}

export interface TldvMeetingData {
  id: string;
  name: string;
  happenedAt: string; // ISO timestamp
  duration: number;   // seconds
  organizer: TldvInvitee;
  invitees: TldvInvitee[];
  url: string;
}

export interface TldvNotesResponse {
  markdownContent: string;
  topics: Array<{ title: string; [key: string]: unknown }>;
}

export interface TldvTranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface TldvTranscriptData {
  segments: TldvTranscriptSegment[];
}

// ── tl;dv API client ──────────────────────────────────────────────────────────

const TLDV_BASE_URL = 'https://pasta.tldv.io/v1alpha1';

export class TldvApiClient {
  constructor(private readonly apiKey: string) {}

  private async request<T>(path: string): Promise<T> {
    const res = await fetch(`${TLDV_BASE_URL}${path}`, {
      headers: { 'x-api-key': this.apiKey },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`tl;dv API ${path} → ${res.status}: ${body}`);
    }

    return res.json() as Promise<T>;
  }

  getMeeting(id: string): Promise<TldvMeetingData> {
    return this.request<TldvMeetingData>(`/meetings/${id}`);
  }

  getNotes(id: string): Promise<TldvNotesResponse> {
    return this.request<TldvNotesResponse>(`/meetings/${id}/notes`);
  }

  getTranscript(id: string): Promise<{ data: TldvTranscriptData }> {
    return this.request<{ data: TldvTranscriptData }>(`/meetings/${id}/transcript`);
  }

  async listMeetings(
    dateFrom: string,
    dateTo: string,
    limit = 50,
    page = 1,
  ): Promise<TldvMeetingData[]> {
    const params = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      limit: String(limit),
      page: String(page),
    });
    const res = await this.request<{ data?: TldvMeetingData[]; meetings?: TldvMeetingData[] }>(
      `/meetings?${params}`,
    );
    // tolerate either shape
    return res.data ?? res.meetings ?? [];
  }

  /** Paginate through all meetings in the date range. */
  async listAllMeetings(dateFrom: string, dateTo: string): Promise<TldvMeetingData[]> {
    const all: TldvMeetingData[] = [];
    let page = 1;

    while (true) {
      const batch = await this.listMeetings(dateFrom, dateTo, 50, page);
      if (!batch.length) break;
      all.push(...batch);
      if (batch.length < 50) break;
      page++;
    }

    return all;
  }
}

// ── Credential loader ─────────────────────────────────────────────────────────

export interface TldvCredentials {
  api_key: string;
  webhook_header_name?: string;
  webhook_header_value?: string;
}

export async function loadTldvCredentials(
  supabase: SupabaseClient,
): Promise<TldvCredentials | null> {
  const { data } = await supabase
    .from('omni_channel_configs')
    .select('credentials, is_active')
    .eq('channel', 'tldv')
    .maybeSingle();

  if (!data || !data.is_active) return null;

  const creds = data.credentials as TldvCredentials | null;
  if (!creds?.api_key) return null;

  return creds;
}

// ── Meeting matcher ───────────────────────────────────────────────────────────

export interface MatchResult {
  meeting_id: string | null;
}

/**
 * Finds the RevOS `meetings` row that best matches a tl;dv meeting.
 *
 * Strategy:
 *   - Collect all attendee emails (organizer + invitees)
 *   - Look for meetings whose start_time falls within happenedAt ±90 min
 *   - At least one attendee email must match either the lead's person email
 *     or the assigned user's email
 */
export async function findMatchingMeeting(
  supabase: SupabaseClient,
  happenedAt: string,
  emails: string[],
): Promise<MatchResult> {
  if (!emails.length) return { meeting_id: null };

  const pivot = new Date(happenedAt);
  const windowMs = 90 * 60 * 1000;
  const dateFrom = new Date(pivot.getTime() - windowMs).toISOString();
  const dateTo = new Date(pivot.getTime() + windowMs).toISOString();

  // Raw query via RPC not available here; use chained joins via select.
  // We filter by start_time window first, then apply email matching in JS
  // on the small result set — avoids a complex OR across two joined tables.
  const { data: candidates } = await supabase
    .from('meetings')
    .select(`
      id,
      leads:leads_id (
        people:people_id (
          email
        )
      ),
      user:users_id (
        email
      )
    `)
    .gte('start_time', dateFrom)
    .lte('start_time', dateTo);

  if (!candidates?.length) return { meeting_id: null };

  const emailSet = new Set(emails.map((e) => e.toLowerCase()));

  for (const m of candidates) {
    const leadEmail = (m.leads as { people?: { email?: string } } | null)?.people?.email;
    const userEmail = (m.user as { email?: string } | null)?.email;

    if (
      (leadEmail && emailSet.has(leadEmail.toLowerCase())) ||
      (userEmail && emailSet.has(userEmail.toLowerCase()))
    ) {
      return { meeting_id: m.id as string };
    }
  }

  return { meeting_id: null };
}

// ── Idempotency check ─────────────────────────────────────────────────────────

/**
 * Returns true if a meeting_record with the given tldv_meeting_id already exists.
 */
export async function tldvRecordExists(
  supabase: SupabaseClient,
  tldvMeetingId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('meeting_records')
    .select('id')
    .eq('tldv_meeting_id', tldvMeetingId)
    .maybeSingle();

  return !!data;
}
