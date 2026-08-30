import { useMemo } from "react";
import { useScoreCategories, useAllScoreCategoryItems } from "./useScoreCategories";
import { useAllLeadFieldDefinitions } from "./useLeadFieldDefinitions";
import type { LpFormField } from "./useLpForms";

// Maps base category slugs to legacy lp-submit keys (backward compat with SCORE_COLUMN_MAP)
const SLUG_TO_LEGACY_KEY: Record<string, string> = {
  objectives: "objetivo",
  investments: "investimento",
  framings: "enquadramento",
};

export interface CatalogField {
  crm_field: string;
  label: string;
  type: LpFormField["type"];
  placeholder?: string;
  options?: { value: string; label: string; tags: string[] }[];
  required_type?: boolean;
}

export interface CatalogGroup {
  id: string;
  label: string;
  icon: string;
  fields: CatalogField[];
  /** If true, "Add all" shortcut is shown in the picker */
  allowAddAll?: boolean;
}

function mapFieldType(type: string): LpFormField["type"] {
  const map: Record<string, LpFormField["type"]> = {
    text: "text",
    email: "email",
    phone: "phone",
    tel: "phone",
    select: "select",
    single_select: "select",   // CamposExtrasConfig field type
    multi_select: "select",
    radio: "radio",
    checkbox: "checkbox",
    boolean: "checkbox",
    textarea: "textarea",
    date: "date",
    number: "text",
  };
  return map[type] ?? "text";
}

export function useLpFormCatalog(): { groups: CatalogGroup[]; isLoading: boolean } {
  const { data: categories = [], isLoading: loadingCats } = useScoreCategories();
  const { data: allItems = [], isLoading: loadingItems } = useAllScoreCategoryItems();
  // Use ALL definitions (no pipeline filter) so pipeline-specific fields are always visible
  const { data: allDefs = [], isLoading: loadingDefs } = useAllLeadFieldDefinitions();

  const isLoading = loadingCats || loadingItems || loadingDefs;

  const groups = useMemo<CatalogGroup[]>(() => {
    const pessoaGroup: CatalogGroup = {
      id: "pessoa",
      label: "Pessoa",
      icon: "👤",
      fields: [
        { crm_field: "pessoa.nome",      label: "Nome",            type: "text",     placeholder: "Nome completo" },
        { crm_field: "pessoa.email",     label: "E-mail",          type: "email",    placeholder: "email@exemplo.com", required_type: true },
        { crm_field: "pessoa.whatsapp",  label: "WhatsApp",        type: "phone",    placeholder: "(11) 99999-9999" },
        { crm_field: "pessoa.instagram", label: "Instagram",       type: "text",     placeholder: "@usuario" },
        { crm_field: "pessoa.notas",     label: "Observações",     type: "textarea", placeholder: "Notas sobre o lead..." },
        { crm_field: "pessoa.documento", label: "CPF / Documento", type: "text",     placeholder: "000.000.000-00" },
      ],
    };

    const empresaGroup: CatalogGroup = {
      id: "empresa",
      label: "Empresa",
      icon: "🏢",
      fields: [
        { crm_field: "empresa.nome",     label: "Empresa",          type: "text",  placeholder: "Nome da empresa" },
        { crm_field: "empresa.site",     label: "Site",             type: "text",  placeholder: "https://..." },
        { crm_field: "empresa.cnpj",     label: "CNPJ",             type: "text",  placeholder: "00.000.000/0001-00" },
        { crm_field: "empresa.telefone", label: "Telefone Empresa", type: "phone", placeholder: "(11) 3000-0000" },
        { crm_field: "empresa.email",    label: "E-mail Empresa",   type: "email", placeholder: "contato@empresa.com", required_type: true },
      ],
    };

    const scoreGroup: CatalogGroup = {
      id: "score",
      label: "Score PRO™",
      icon: "⭐",
      fields: categories
        .filter((cat) => cat.active)
        .map((cat) => {
          const legacyKey = cat.slug ? (SLUG_TO_LEGACY_KEY[cat.slug] ?? cat.id) : cat.id;
          return {
            crm_field: `score.${legacyKey}`,
            label: cat.name,
            type: "select" as LpFormField["type"],
            options: allItems
              .filter((i) => i.category_id === cat.id && i.active)
              .map((i) => ({ value: i.id, label: i.name, tags: [] })),
          };
        }),
    };

    // UTMs + Click IDs are now captured natively by PublicFormPage (no manual fields needed)

    const result: CatalogGroup[] = [pessoaGroup, empresaGroup, scoreGroup];

    // Use ALL active definitions — no pipeline filter, no agent_managed exclusion.
    // The user decides what to put on their form.
    const activeDefs = (allDefs as Array<{
      key: string; name: string; type: string;
      agent_managed: boolean; options: unknown;
      active: boolean; entity_type: string;
    }>).filter((f) => f.active);

    const customPessoaFields: CatalogField[] = activeDefs
      .filter((f) => f.entity_type === "pessoa")
      .map((f) => ({
        crm_field: `custom.${f.key}`,
        label: f.name,
        type: mapFieldType(f.type),
        options: Array.isArray(f.options)
          ? (f.options as Array<{ value: string; label: string }>).map((o) => ({
              value: o.value, label: o.label, tags: [],
            }))
          : undefined,
      }));

    const customNegocioFields: CatalogField[] = activeDefs
      .filter((f) => f.entity_type !== "pessoa")
      .map((f) => ({
        crm_field: `custom.${f.key}`,
        label: f.name,
        type: mapFieldType(f.type),
        options: Array.isArray(f.options)
          ? (f.options as Array<{ value: string; label: string }>).map((o) => ({
              value: o.value, label: o.label, tags: [],
            }))
          : undefined,
      }));

    // Merge all custom fields into one group — pessoa + negocio/empresa together
    const allCustomFields = [...customPessoaFields, ...customNegocioFields];
    result.push({
      id: "custom",
      label: "Campos Personalizados",
      icon: "🔧",
      fields: allCustomFields,
    });

    return result;
  }, [categories, allItems, allDefs]);

  return { groups, isLoading };
}
