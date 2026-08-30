/**
 * WHATSAPP TEMPLATES SYNC — pure, testable core (WAT-SYNC-03)
 *
 * The HTTP handler in ../whatsapp-templates-sync/index.ts is a thin wrapper
 * around these functions. Everything here is free of `Deno.serve` so it can be
 * imported by tests without binding a port.
 */

import type { createLogger } from './logger.ts';

export const GRAPH_API_VERSION = 'v23.0';
export const TEMPLATE_FIELDS = 'id,name,status,category,language,components,parameter_format';

export interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: Array<Record<string, unknown>>;
  parameter_format?: string;
}

export interface MetaPageResponse {
  data: MetaTemplate[];
  paging?: {
    cursors?: { after?: string };
    next?: string;
  };
}

export interface MetaApiError {
  status: number;
  message: string;
}

type Log = ReturnType<typeof createLogger>;

// ── Fetch all templates from Meta with cursor-based pagination ───────────────

export async function fetchAllMetaTemplates(
  wabaId: string,
  accessToken: string,
  log: Log,
  fetchImpl: typeof fetch = fetch,
): Promise<MetaTemplate[]> {
  const all: MetaTemplate[] = [];
  let url =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates?fields=${TEMPLATE_FIELDS}&limit=100`;

  while (url) {
    const res = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.text();
      log.error('meta_api_error', { status: res.status, body });

      if (res.status === 403 || res.status === 401) {
        throw {
          status: 403,
          message:
            'Token sem permissão para gerenciar templates. Verifique as permissões no Meta Business Manager.',
        } satisfies MetaApiError;
      }
      if (res.status === 400) {
        throw {
          status: 400,
          message: 'WABA ID inválido ou não encontrado. Verifique a configuração do canal.',
        } satisfies MetaApiError;
      }
      throw { status: res.status, message: `Meta API error: ${res.status}` } satisfies MetaApiError;
    }

    const page: MetaPageResponse = await res.json();
    all.push(...(page.data || []));

    url = page.paging?.next ?? '';
  }

  log.info('meta_templates_fetched', { count: all.length });
  return all;
}

// ── Row shaping ──────────────────────────────────────────────────────────────

export interface TemplateRow {
  name: string;
  slug: string;
  id_template: string;
  meta_template_name: string;
  status: string;
  json_data: Record<string, unknown>;
  updated_at: string;
  last_synced_at: string;
}

export function buildSlug(tpl: Pick<MetaTemplate, 'name' | 'language'>): string {
  return `${tpl.name}|${tpl.language}`;
}

export function buildTemplateRow(tpl: MetaTemplate, syncedAt: string): TemplateRow {
  return {
    name: tpl.name,
    slug: buildSlug(tpl),
    id_template: tpl.id,
    meta_template_name: tpl.name,
    status: tpl.status.toLowerCase(),
    json_data: {
      category: tpl.category,
      language: tpl.language,
      components: tpl.components,
      ...(tpl.parameter_format ? { parameter_format: tpl.parameter_format } : {}),
    },
    updated_at: syncedAt,
    last_synced_at: syncedAt,
  };
}

// ── Reconciliation predicate ─────────────────────────────────────────────────

export interface LocalTemplateRef {
  id: string;
  slug: string | null;
  id_template: string | null;
  name: string | null;
}

/**
 * A local template should be soft-deleted only when it carries a *real* Meta id
 * (not a `pending_*` placeholder) and that id is absent from Meta's response.
 *
 * Placeholder ids may still exist on Meta under a real id, so they must never be
 * reconciled away — that was the WAT-SYNC-01 bug.
 */
export function shouldSoftDelete(local: LocalTemplateRef, metaIds: Set<string>): boolean {
  if (!local.id_template) return false;
  if (local.id_template.startsWith('pending_')) return false;
  return !metaIds.has(local.id_template);
}

// ── Match resolution ─────────────────────────────────────────────────────────

export type MatchKind = 'id_template' | 'slug' | 'name' | 'none';

export interface MatchResult {
  kind: MatchKind;
  id: string | null;
  /** Set only on a `name` match — the placeholder/old id we are about to fix. */
  previousIdTemplate?: string | null;
}

/**
 * Minimal surface of the Supabase client used by match resolution.
 * Enough to mock in tests without pulling the real client.
 */
export interface TemplateLookupClient {
  matchByIdTemplate(idTemplate: string): Promise<{ id: string; slug: string | null } | null>;
  matchBySlug(slug: string): Promise<{ id: string } | null>;
  matchByName(name: string): Promise<{ id: string; id_template: string | null } | null>;
}

/**
 * Resolve which existing local row (if any) a Meta template maps to, trying
 * id_template → slug → name in that order. A `name` match is what fixes rows
 * whose id_template is a `pending_*` placeholder.
 */
export async function resolveTemplateMatch(
  client: TemplateLookupClient,
  tpl: MetaTemplate,
): Promise<MatchResult> {
  const byId = await client.matchByIdTemplate(tpl.id);
  if (byId) return { kind: 'id_template', id: byId.id };

  const slug = buildSlug(tpl);
  const bySlug = await client.matchBySlug(slug);
  if (bySlug) return { kind: 'slug', id: bySlug.id };

  const byName = await client.matchByName(tpl.name);
  if (byName) {
    return { kind: 'name', id: byName.id, previousIdTemplate: byName.id_template };
  }

  return { kind: 'none', id: null };
}
