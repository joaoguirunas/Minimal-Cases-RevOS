import { useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronsUpDown } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useLeadFieldDefinitionsByEntity } from '@/hooks/useLeadFieldDefinitions';
import { useScoreCategories, useAllScoreCategoryItems } from '@/hooks/useScoreCategories';
import type { SendChannel } from '@/types/sends';
import type { FieldMappingConfig } from '@/hooks/useImportarLista';

interface CrmOption {
  value: string;
  label: string;
  group: string;
}

interface FieldMapperProps {
  headers: string[];
  channel: SendChannel;
  pipelineId: string | null;
  createLeads: boolean;
  mapping: FieldMappingConfig;
  onChange: (m: FieldMappingConfig) => void;
  rows?: Record<string, string>[];
}

// ── Heuristics ────────────────────────────────────────────────────────────────

const HEURISTICS: Record<keyof Pick<FieldMappingConfig, 'name' | 'whatsapp' | 'email'>, string[]> = {
  name:     ['nome', 'name', 'cliente', 'contact', 'contato', 'responsavel'],
  whatsapp: ['whatsapp', 'telefone', 'phone', 'celular', 'fone', 'tel', 'numero', 'mobile', 'movel'],
  email:    ['email', 'e-mail', 'mail', 'correio'],
};

// lead_control is always set to '1' by the import flow — not mapped from CSV columns

// Additional key-based aliases for CRM extra field auto-detection
const FIELD_KEY_ALIASES: Record<string, string[]> = {
  cpf:      ['cpf', 'documento', 'doc', 'rg', 'cnpj'],
  endereco: ['endereco', 'address', 'logradouro', 'rua', 'avenida', 'av'],
  cidade:   ['cidade', 'city', 'municipio'],
  estado:   ['estado', 'state', 'uf', 'provincia'],
  cep:      ['cep', 'zip', 'zipcode', 'postal', 'codigopostal'],
  cargo:    ['cargo', 'position', 'role', 'funcao', 'profissao', 'ocupacao'],
};

const COMPANY_KEY_ALIASES: Record<string, string[]> = {
  trade_name: ['nomefantasia', 'nomeempresa', 'empresa', 'fantasia', 'tradename'],
  legal_name: ['razaosocial', 'razao', 'nomelegal', 'legalname'],
  tax_id:     ['cnpj', 'cpfempresa', 'taxid', 'documento', 'inscricao'],
  address:    ['enderecoempresa', 'endereco', 'logradouro'],
  website:    ['site', 'website', 'url', 'pagina'],
  email:      ['emailempresa', 'emailcorporativo'],
  phone:      ['telefoneempresa', 'foneempresa', 'telcorp'],
};

const COMPANY_STRUCT_LABELS: Record<string, string> = {
  trade_name: 'Nome Fantasia',
  legal_name: 'Razão Social',
  tax_id:     'CNPJ / Tax ID',
  address:    'Endereço da Empresa',
  website:    'Website',
  email:      'E-mail da Empresa',
  phone:      'Telefone da Empresa',
};

const LEAD_NATIVE_COL_LABELS: Record<string, string> = {
  recomendante:         'Recomendante',
  relacao_recomendante: 'Relação do Recomendante',
  relacao_corretor:     'Relação do Corretor',
  nome_evento:          'Nome do Evento',
};

function normalizeStr(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function autoDetectBase(headers: string[]): Partial<FieldMappingConfig> {
  const result: Partial<FieldMappingConfig> = {};
  for (const [field, keywords] of Object.entries(HEURISTICS) as [keyof typeof HEURISTICS, string[]][]) {
    const match = headers.find((h) =>
      keywords.some((kw) => normalizeStr(h).includes(normalizeStr(kw))),
    );
    if (match) result[field] = match;
  }
  // Auto-detect native leads columns (recomendante, relacao_recomendante, relacao_corretor, nome_evento)
  // Two-pass: exact matches first to avoid `recomendante` consuming `relacao_recomendante` header.
  const leadCols: Record<string, string> = {};
  const usedHeaders = new Set<string>();
  for (const colKey of Object.keys(LEAD_NATIVE_COL_LABELS)) {
    const normKey = normalizeStr(colKey);
    const match = headers.find((h) => !usedHeaders.has(h) && normalizeStr(h) === normKey);
    if (match) { leadCols[colKey] = match; usedHeaders.add(match); }
  }
  for (const colKey of Object.keys(LEAD_NATIVE_COL_LABELS)) {
    if (leadCols[colKey]) continue;
    const normKey = normalizeStr(colKey);
    const match = headers.find((h) => !usedHeaders.has(h) && normalizeStr(h).includes(normKey));
    if (match) { leadCols[colKey] = match; usedHeaders.add(match); }
  }
  if (Object.keys(leadCols).length > 0) result.lead_cols = leadCols;
  return result;
}

// ── Validation ────────────────────────────────────────────────────────────────

function getRequiredContactField(channel: SendChannel): keyof FieldMappingConfig {
  if (channel === 'email') return 'email';
  return 'whatsapp';
}

function getMissingRequired(mapping: FieldMappingConfig, channel: SendChannel): string[] {
  const missing: string[] = [];
  if (!mapping.name) missing.push('Nome');
  const contactField = getRequiredContactField(channel);
  if (!mapping[contactField]) {
    missing.push(contactField === 'email' ? 'E-mail' : 'WhatsApp / Telefone');
  }
  return missing;
}

// ── CRM Field Combobox ────────────────────────────────────────────────────────

interface CrmFieldComboboxProps {
  value: string | undefined;
  onChange: (v: string | null) => void;
  options: CrmOption[];
  required?: boolean;
}

function CrmFieldCombobox({ value, onChange, options, required }: CrmFieldComboboxProps) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, CrmOption[]>();
    for (const opt of options) {
      if (!map.has(opt.group)) map.set(opt.group, []);
      map.get(opt.group)!.push(opt);
    }
    return map;
  }, [options]);

  const isMapped = !!value;
  const displayLabel = isMapped
    ? (options.find((o) => o.value === value)?.label ?? value)
    : '(Ignorar)';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-[30px] w-full items-center justify-between rounded-md border px-2.5 text-[12px] bg-background transition-colors hover:bg-accent/30',
            isMapped ? 'border-primary/30 text-foreground' : 'border-input text-muted-foreground',
            required && !isMapped && 'border-destructive/40',
          )}
        >
          <span className="truncate text-left flex-1">{displayLabel}</span>
          <ChevronsUpDown className="w-3 h-3 shrink-0 text-muted-foreground/60 ml-1" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar campo..." className="h-8 text-[12px]" />
          <CommandList>
            <CommandEmpty className="text-[12px] text-muted-foreground py-3 text-center">
              Nenhum campo encontrado.
            </CommandEmpty>
            <CommandItem
              value="ignorar-campo"
              keywords={['ignorar', 'ignore', 'nenhum']}
              onSelect={() => { onChange(null); setOpen(false); }}
              className="text-[12px] text-muted-foreground"
            >
              <Check className={cn('mr-2 h-3 w-3', !isMapped ? 'opacity-100' : 'opacity-0')} />
              (Ignorar)
            </CommandItem>
            {[...groups.entries()].map(([groupLabel, items]) => (
              <CommandGroup key={groupLabel} heading={groupLabel}>
                {items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={item.value}
                    keywords={[item.label, item.group]}
                    onSelect={() => { onChange(item.value); setOpen(false); }}
                    className="text-[12px]"
                  >
                    <Check className={cn('mr-2 h-3 w-3', value === item.value ? 'opacity-100' : 'opacity-0')} />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Value Mapping ─────────────────────────────────────────────────────────────

interface ValueMappingProps {
  header: string;
  rows: Record<string, string>[];
  options: Array<{ value: string; label: string }>;
  valueMaps: Record<string, string>;
  onValueMapsChange: (m: Record<string, string>) => void;
}

function ValueMapping({ header, rows, options, valueMaps, onValueMapsChange }: ValueMappingProps) {
  const uniqueVals = useMemo(
    () => [...new Set(rows.map((r) => r[header]).filter(Boolean))].slice(0, 30),
    [rows, header],
  );

  if (uniqueVals.length === 0 || options.length === 0) return null;

  return (
    <div className="mt-1.5 mb-0.5 ml-[calc(12rem+1.5rem)] border-l-2 border-primary/15 pl-3 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1">
        Mapeamento de valores ({uniqueVals.length} únicos)
      </p>
      {uniqueVals.map((csvVal) => (
        <div key={csvVal} className="flex items-center gap-2">
          <span
            className="w-28 text-[11px] font-mono text-muted-foreground truncate shrink-0"
            title={csvVal}
          >
            {csvVal}
          </span>
          <span className="text-muted-foreground/30 text-[10px] shrink-0">→</span>
          <Select
            value={valueMaps[csvVal] ?? ''}
            onValueChange={(v) => onValueMapsChange({ ...valueMaps, [csvVal]: v })}
          >
            <SelectTrigger className="h-[24px] text-[11px] flex-1 min-w-0">
              <SelectValue placeholder="(ignorar)" />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-[11px]">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}

// ── Mapping Row ───────────────────────────────────────────────────────────────

interface MappingRowProps {
  headerCsv: string;
  value: string | undefined;
  onChange: (v: string | null) => void;
  crmOptions: CrmOption[];
  required?: boolean;
  showValueMap: boolean;
  valueMapOptions: Array<{ value: string; label: string }>;
  valueMaps: Record<string, string>;
  onValueMapsChange: (m: Record<string, string>) => void;
  rows: Record<string, string>[];
}

function MappingRow({
  headerCsv, value, onChange, crmOptions, required,
  showValueMap, valueMapOptions, valueMaps, onValueMapsChange, rows,
}: MappingRowProps) {
  const isMapped = !!value;

  return (
    <div className="border-b border-border last:border-0">
      <div className="flex items-center gap-3 py-2">
        {/* CSV column */}
        <div className="w-48 shrink-0">
          <p className="text-[12px] font-mono text-foreground truncate" title={headerCsv}>
            {headerCsv}
          </p>
          {required && !isMapped && (
            <p className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
              <AlertCircle className="w-3 h-3" strokeWidth={1.5} /> Obrigatório
            </p>
          )}
        </div>

        {/* Arrow */}
        <span className="text-muted-foreground/40 text-[12px] shrink-0">→</span>

        {/* CRM field combobox */}
        <div className="flex-1 min-w-0">
          <CrmFieldCombobox
            value={value}
            onChange={onChange}
            options={crmOptions}
            required={required}
          />
        </div>

        {/* Status indicator */}
        <div className="w-5 shrink-0">
          {isMapped && <Check className="w-4 h-4 text-primary" strokeWidth={2} />}
        </div>
      </div>

      {/* Value mapping sub-section */}
      {showValueMap && isMapped && (
        <ValueMapping
          header={headerCsv}
          rows={rows}
          options={valueMapOptions}
          valueMaps={valueMaps}
          onValueMapsChange={onValueMapsChange}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FieldMapper({
  headers,
  channel,
  pipelineId,
  createLeads,
  mapping,
  onChange,
  rows = [],
}: FieldMapperProps) {
  const { data: crmPersonFields = [] } = useLeadFieldDefinitionsByEntity('pessoa');
  const { data: crmEmpresaFields = [] } = useLeadFieldDefinitionsByEntity('empresa');
  const { data: leadDealFieldsNegocio = [] } = useLeadFieldDefinitionsByEntity(
    'negocio',
    pipelineId ?? undefined,
  );
  const { data: leadDealFieldsLead = [] } = useLeadFieldDefinitionsByEntity(
    'lead',
    pipelineId ?? undefined,
  );
  const leadDealFields = [...leadDealFieldsNegocio, ...leadDealFieldsLead];
  const { data: scoreCategories = [] } = useScoreCategories();
  const { data: allScoreItems = [] } = useAllScoreCategoryItems();

  // ── Build CRM option list ──────────────────────────────────────────────────

  const crmOptions = useMemo<CrmOption[]>(() => {
    const base: CrmOption[] = [
      { value: 'name',     label: 'Nome completo',       group: 'Dados do Contato' },
      { value: 'whatsapp', label: 'WhatsApp / Telefone',  group: 'Dados do Contato' },
      { value: 'email',    label: 'E-mail',               group: 'Dados do Contato' },
    ];
    const crmExtras: CrmOption[] = crmPersonFields.map((f) => ({
      value: `crm_extra:${f.key}`,
      label: f.name,
      group: 'Campos Extras — Pessoa',
    }));
    const empresaExtras: CrmOption[] = crmEmpresaFields.map((f) => ({
      value: `empresa_extra:${f.key}`,
      label: f.name,
      group: 'Campos Extras — Empresa',
    }));
    const leadBase: CrmOption[] = [
      ...Object.entries(LEAD_NATIVE_COL_LABELS).map(([key, label]) => ({
        value: `lead_col:${key}`,
        label,
        group: 'Dados do Negócio',
      })),
    ];
    const leadExtras: CrmOption[] = pipelineId
      ? leadDealFields.map((f) => ({
          value: `lead_extra:${f.key}`,
          label: f.name,
          group: 'Campos Extras — Negócio',
        }))
      : [];
    const scoreOpts: CrmOption[] = scoreCategories.map((cat) => ({
      value: `score_cat:${cat.id}`,
      label: cat.name,
      group: 'Score PRO™',
    }));
    const companyStructOpts: CrmOption[] = Object.entries(COMPANY_STRUCT_LABELS).map(([key, label]) => ({
      value: `company_struct:${key}`,
      label,
      group: 'Dados de Empresa',
    }));
    return [...base, ...crmExtras, ...empresaExtras, ...leadBase, ...leadExtras, ...scoreOpts, ...companyStructOpts];
  }, [crmPersonFields, crmEmpresaFields, leadDealFields, scoreCategories, pipelineId]);

  // ── Auto-detect base fields ────────────────────────────────────────────────

  const autoDetected = useMemo(() => autoDetectBase(headers), [headers]);

  // ── Auto-detect extra fields (label + key alias matching) ─────────────────

  const autoDetectedExtras = useMemo(() => {
    const crm_extra: Record<string, string> = {};
    const lead_extra: Record<string, string> = {};
    const score_cat: Record<string, string> = {};
    const company_struct: Record<string, string> = {};

    for (const h of headers) {
      const normH = normalizeStr(h);

      // CRM pessoa extras
      for (const f of crmPersonFields) {
        if (crm_extra[f.key]) continue;
        const normName = normalizeStr(f.name);
        const normKey  = normalizeStr(f.key);
        const keyAliases = FIELD_KEY_ALIASES[normKey] ?? [normKey];
        const matchesName  = normName.includes(normH) || normH.includes(normName);
        const matchesAlias = keyAliases.some((a) => normH.includes(a) || a.includes(normH));
        if (matchesName || matchesAlias) crm_extra[f.key] = h;
      }

      // CRM negócio extras
      if (createLeads && pipelineId) {
        for (const f of leadDealFields) {
          if (lead_extra[f.key]) continue;
          const normName = normalizeStr(f.name);
          const normKey  = normalizeStr(f.key);
          const keyAliases = FIELD_KEY_ALIASES[normKey] ?? [normKey];
          const matchesName  = normName.includes(normH) || normH.includes(normName);
          const matchesAlias = keyAliases.some((a) => normH.includes(a) || a.includes(normH));
          if (matchesName || matchesAlias) lead_extra[f.key] = h;
        }
      }

      // Score categories
      for (const cat of scoreCategories) {
        if (score_cat[cat.id]) continue;
        const normCat = normalizeStr(cat.name);
        if (normH.includes(normCat) || normCat.includes(normH)) score_cat[cat.id] = h;
      }

      // Company struct fields — only match if the header CONTAINS the alias (not reverse),
      // to prevent short common words (e.g. "nome") from matching longer aliases (e.g. "nomefantasia").
      for (const compKey of Object.keys(COMPANY_STRUCT_LABELS)) {
        if (company_struct[compKey]) continue;
        const aliases = COMPANY_KEY_ALIASES[compKey] ?? [normalizeStr(compKey)];
        if (aliases.some((a) => normH === normalizeStr(a) || normH.includes(normalizeStr(a)))) {
          company_struct[compKey] = h;
        }
      }
    }

    return { crm_extra, lead_extra, score_cat, company_struct };
  }, [headers, crmPersonFields, leadDealFields, scoreCategories, createLeads, pipelineId]);

  // ── Merge auto-detect into mapping (only for empty fields) ────────────────

  const effectiveMapping = useMemo<FieldMappingConfig>(() => {
    const base: FieldMappingConfig = { ...autoDetected, ...mapping };
    if (!mapping.crm_extra && Object.keys(autoDetectedExtras.crm_extra).length > 0) {
      base.crm_extra = autoDetectedExtras.crm_extra;
    }
    if (!mapping.lead_extra && Object.keys(autoDetectedExtras.lead_extra).length > 0) {
      base.lead_extra = autoDetectedExtras.lead_extra;
    }
    if (!mapping.score_cat && Object.keys(autoDetectedExtras.score_cat).length > 0) {
      base.score_cat = autoDetectedExtras.score_cat;
    }
    if (!mapping.company_struct && Object.keys(autoDetectedExtras.company_struct).length > 0) {
      base.company_struct = autoDetectedExtras.company_struct;
    }
    if (!mapping.lead_cols && autoDetected.lead_cols && Object.keys(autoDetected.lead_cols).length > 0) {
      base.lead_cols = autoDetected.lead_cols;
    }
    if (!mapping.empresa_extra) {
      base.empresa_extra = {};
    }
    return base;
  }, [mapping, autoDetected, autoDetectedExtras]);

  // ── Derive per-header selected value from effectiveMapping ────────────────

  const getValueForHeader = (header: string): string | undefined => {
    for (const [field, v] of Object.entries(effectiveMapping) as [keyof FieldMappingConfig, unknown][]) {
      if (['crm_extra', 'lead_extra', 'empresa_extra', 'score_cat', 'value_maps', 'q_field', 'company_struct'].includes(field)) continue;
      if (v === header) return field as string;
    }
    for (const [fKey, hdr] of Object.entries(effectiveMapping.crm_extra ?? {})) {
      if (hdr === header) return `crm_extra:${fKey}`;
    }
    for (const [fKey, hdr] of Object.entries(effectiveMapping.lead_extra ?? {})) {
      if (hdr === header) return `lead_extra:${fKey}`;
    }
    for (const [fKey, hdr] of Object.entries(effectiveMapping.empresa_extra ?? {})) {
      if (hdr === header) return `empresa_extra:${fKey}`;
    }
    for (const [catId, hdr] of Object.entries(effectiveMapping.score_cat ?? {})) {
      if (hdr === header) return `score_cat:${catId}`;
    }
    for (const [qKey, hdr] of Object.entries(effectiveMapping.q_field ?? {})) {
      if (hdr === header) return `q_field:${qKey}`;
    }
    for (const [compKey, hdr] of Object.entries(effectiveMapping.company_struct ?? {})) {
      if (hdr === header) return `company_struct:${compKey}`;
    }
    for (const [colKey, hdr] of Object.entries(effectiveMapping.lead_cols ?? {})) {
      if (hdr === header) return `lead_col:${colKey}`;
    }
    return undefined;
  };

  const handleChange = (header: string, selected: string | null) => {
    // Remove header from any previous binding
    const cleaned: FieldMappingConfig = {
      name:         effectiveMapping.name         === header ? undefined : effectiveMapping.name,
      whatsapp:     effectiveMapping.whatsapp     === header ? undefined : effectiveMapping.whatsapp,
      email:        effectiveMapping.email        === header ? undefined : effectiveMapping.email,

      crm_extra: Object.fromEntries(
        Object.entries(effectiveMapping.crm_extra ?? {}).filter(([, v]) => v !== header),
      ),
      lead_extra: Object.fromEntries(
        Object.entries(effectiveMapping.lead_extra ?? {}).filter(([, v]) => v !== header),
      ),
      empresa_extra: Object.fromEntries(
        Object.entries(effectiveMapping.empresa_extra ?? {}).filter(([, v]) => v !== header),
      ),
      score_cat: Object.fromEntries(
        Object.entries(effectiveMapping.score_cat ?? {}).filter(([, v]) => v !== header),
      ),
      q_field: Object.fromEntries(
        Object.entries(effectiveMapping.q_field ?? {}).filter(([, v]) => v !== header),
      ),
      company_struct: Object.fromEntries(
        Object.entries(effectiveMapping.company_struct ?? {}).filter(([, v]) => v !== header),
      ),
      lead_cols: Object.fromEntries(
        Object.entries(effectiveMapping.lead_cols ?? {}).filter(([, v]) => v !== header),
      ),
      value_maps: effectiveMapping.value_maps,
    };

    if (!selected) { onChange(cleaned); return; }

    if (selected.startsWith('crm_extra:')) {
      const key = selected.slice('crm_extra:'.length);
      onChange({ ...cleaned, crm_extra: { ...cleaned.crm_extra, [key]: header } });
    } else if (selected.startsWith('lead_extra:')) {
      const key = selected.slice('lead_extra:'.length);
      onChange({ ...cleaned, lead_extra: { ...cleaned.lead_extra, [key]: header } });
    } else if (selected.startsWith('empresa_extra:')) {
      const key = selected.slice('empresa_extra:'.length);
      onChange({ ...cleaned, empresa_extra: { ...cleaned.empresa_extra, [key]: header } });
    } else if (selected.startsWith('score_cat:')) {
      const catId = selected.slice('score_cat:'.length);
      onChange({ ...cleaned, score_cat: { ...cleaned.score_cat, [catId]: header } });
    } else if (selected.startsWith('q_field:')) {
      const qKey = selected.slice('q_field:'.length);
      onChange({ ...cleaned, q_field: { ...cleaned.q_field, [qKey]: header } });
    } else if (selected.startsWith('company_struct:')) {
      const compKey = selected.slice('company_struct:'.length);
      onChange({ ...cleaned, company_struct: { ...cleaned.company_struct, [compKey]: header } });
    } else if (selected.startsWith('lead_col:')) {
      const colKey = selected.slice('lead_col:'.length);
      onChange({ ...cleaned, lead_cols: { ...cleaned.lead_cols, [colKey]: header } });
    } else {
      onChange({ ...cleaned, [selected]: header });
    }
  };

  // ── Value map helpers ─────────────────────────────────────────────────────

  const getValueMapInfo = (header: string): { show: boolean; options: Array<{ value: string; label: string }> } => {
    const val = getValueForHeader(header);
    if (!val) return { show: false, options: [] };

    if (val.startsWith('score_cat:')) {
      const catId = val.slice('score_cat:'.length);
      const items = allScoreItems.filter((item) => item.category_id === catId);
      if (items.length === 0) return { show: false, options: [] };
      return {
        show: true,
        options: items.map((item) => ({ value: item.id, label: item.name })),
      };
    }

    if (val.startsWith('crm_extra:')) {
      const key = val.slice('crm_extra:'.length);
      const field = crmPersonFields.find((f) => f.key === key);
      if (field?.type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
        return {
          show: true,
          options: (field.options as Array<{ value: string; label: string }>).map((opt) => ({
            value: opt.value,
            label: opt.label,
          })),
        };
      }
    }

    if (val.startsWith('lead_extra:')) {
      const key = val.slice('lead_extra:'.length);
      const field = leadDealFields.find((f) => f.key === key);
      if (field?.type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
        return {
          show: true,
          options: (field.options as Array<{ value: string; label: string }>).map((opt) => ({
            value: opt.value,
            label: opt.label,
          })),
        };
      }
    }

    return { show: false, options: [] };
  };

  const getValueMap = (header: string): Record<string, string> => {
    const val = getValueForHeader(header);
    if (!val) return {};
    return effectiveMapping.value_maps?.[val] ?? {};
  };

  const handleValueMapChange = (header: string, m: Record<string, string>) => {
    const val = getValueForHeader(header);
    if (!val) return;
    onChange({
      ...effectiveMapping,
      value_maps: { ...effectiveMapping.value_maps, [val]: m },
    });
  };

  // ── Required detection ────────────────────────────────────────────────────

  const missingRequired = getMissingRequired(effectiveMapping, channel);
  const requiredContactField = getRequiredContactField(channel);

  const isRequired = (header: string): boolean => {
    const val = getValueForHeader(header);
    return val === 'name' || val === requiredContactField;
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Validation summary */}
      {missingRequired.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-600 dark:text-amber-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
          <span>
            Campos obrigatórios não mapeados: <strong>{missingRequired.join(', ')}</strong>
          </span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center gap-3 pb-2 border-b border-border">
        <p className="w-48 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/50">Coluna CSV</p>
        <span className="w-4 shrink-0" />
        <p className="flex-1 text-[10px] uppercase tracking-wider text-muted-foreground/50">Campo CRM destino</p>
        <span className="w-5 shrink-0" />
      </div>

      {/* Mapping rows */}
      <div>
        {headers.map((header) => {
          const vmInfo = getValueMapInfo(header);
          return (
            <MappingRow
              key={header}
              headerCsv={header}
              value={getValueForHeader(header)}
              onChange={(v) => handleChange(header, v)}
              crmOptions={crmOptions}
              required={isRequired(header)}
              showValueMap={vmInfo.show}
              valueMapOptions={vmInfo.options}
              valueMaps={getValueMap(header)}
              onValueMapsChange={(m) => handleValueMapChange(header, m)}
              rows={rows}
            />
          );
        })}
      </div>

      {headers.length === 0 && (
        <p className="text-[12px] text-muted-foreground/40 text-center py-6">
          Nenhuma coluna detectada.
        </p>
      )}
    </div>
  );
}
