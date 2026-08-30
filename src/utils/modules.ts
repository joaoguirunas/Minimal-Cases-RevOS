// Single source of truth for the catalog of system modules toggleable in settings.
//
// Used by:
//   - src/hooks/useSystemModules.ts (validate module keys from DB)
//
// Adding a module here requires also adding the corresponding row in the
// `settings_system_modules` table.

export interface ModuleDefinition {
  /** Stable key — matches `settings_system_modules.module_key` and `adm_clients.enabled_modules` entries. */
  key: string;
  /** Display name shown in the ADM UI. */
  name: string;
}

export const ALL_MODULES: readonly ModuleDefinition[] = [
  { key: 'dashboard',    name: 'BI PRO™' },
  { key: 'negocios',     name: 'CRM PRO™' },
  { key: 'clientes',     name: 'CRM Pessoas™' },
  { key: 'conversas',    name: 'OMNI PRO™' },
  { key: 'disparos',     name: 'SENDS PRO™' },
  { key: 'agendamentos', name: 'SCHEDULE PRO™' },
  { key: 'lp',           name: 'FORM PRO™' },
  { key: 'agentes-ia',   name: 'AI AGENTS™' },
  { key: 'score',        name: 'SCORE PRO™' },
] as const;

export const ALL_MODULE_KEYS: ReadonlySet<string> = new Set(ALL_MODULES.map(m => m.key));
