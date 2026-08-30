/**
 * Meta Lead Forms — CRM ↔ Meta field mapping
 *
 * Maps CRM catalog fields (pessoa.*, empresa.*) to Meta Lead Form
 * prefilled fields or custom questions.
 */

// ── CRM → Meta prefilled field mapping ─────────────────────────

export const CRM_TO_META_MAP: Record<string, string> = {
  'pessoa.nome': 'FULL_NAME',
  'pessoa.email': 'EMAIL',
  'pessoa.whatsapp': 'PHONE_NUMBER',
  'empresa.nome': 'COMPANY_NAME',
  'empresa.email': 'WORK_EMAIL',
  'empresa.telefone': 'WORK_PHONE_NUMBER',
};

// All valid Meta prefilled field types
export const META_PREFILLED_TYPES = new Set([
  'FULL_NAME', 'FIRST_NAME', 'LAST_NAME',
  'EMAIL', 'PHONE_NUMBER',
  'COMPANY_NAME', 'JOB_TITLE',
  'WORK_EMAIL', 'WORK_PHONE_NUMBER',
  'CITY', 'STATE', 'COUNTRY', 'ZIP', 'POST_CODE',
  'DATE_OF_BIRTH', 'GENDER', 'MARITAL_STATUS', 'MILITARY_STATUS',
]);

export const MAX_CUSTOM_QUESTIONS = 15;

// ── Types ──────────────────────────────────────────────────────

export interface MetaPrefilledField {
  type: string;  // e.g. 'FULL_NAME', 'EMAIL'
}

export interface MetaCustomQuestion {
  type: 'CUSTOM';
  key: string;
  label: string;
  question_type: 'SHORT_ANSWER' | 'MULTIPLE_CHOICE';
  options?: Array<{ value: string; key: string }>;
}

export type MetaQuestion = MetaPrefilledField | MetaCustomQuestion;

export interface SelectedCrmField {
  crm_field: string;
  label: string;
  type: string;
  options?: Array<{ value: string; label: string }>;
}

export interface MappingResult {
  prefilled: MetaPrefilledField[];
  custom_questions: MetaCustomQuestion[];
  field_mapping: Array<{
    crm_field: string;
    meta_field: string;
    meta_type: 'prefilled' | 'custom';
    label: string;
  }>;
  custom_count: number;
  exceeds_limit: boolean;
}

// ── Mapping Functions ──────────────────────────────────────────

export function mapCrmFieldsToMeta(fields: SelectedCrmField[]): MappingResult {
  const prefilled: MetaPrefilledField[] = [];
  const custom_questions: MetaCustomQuestion[] = [];
  const field_mapping: MappingResult['field_mapping'] = [];
  let customIdx = 0;

  for (const field of fields) {
    const metaType = CRM_TO_META_MAP[field.crm_field];

    if (metaType) {
      // Known mapping → prefilled
      prefilled.push({ type: metaType });
      field_mapping.push({
        crm_field: field.crm_field,
        meta_field: metaType,
        meta_type: 'prefilled',
        label: field.label,
      });
    } else {
      // No direct mapping → custom question
      customIdx++;
      const key = `custom_${customIdx}`;
      const hasOptions = field.options && field.options.length > 0;

      const question: MetaCustomQuestion = {
        type: 'CUSTOM',
        key,
        label: field.label,
        question_type: hasOptions ? 'MULTIPLE_CHOICE' : 'SHORT_ANSWER',
        ...(hasOptions
          ? {
              options: field.options!.map((o, i) => ({
                value: o.label || o.value,
                key: `${key}_opt_${i}`,
              })),
            }
          : {}),
      };

      custom_questions.push(question);
      field_mapping.push({
        crm_field: field.crm_field,
        meta_field: key,
        meta_type: 'custom',
        label: field.label,
      });
    }
  }

  return {
    prefilled,
    custom_questions,
    field_mapping,
    custom_count: custom_questions.length,
    exceeds_limit: custom_questions.length > MAX_CUSTOM_QUESTIONS,
  };
}

export function buildMetaFormPayload(
  name: string,
  mappingResult: MappingResult,
  thankYou: { title: string; body: string },
  privacyUrl: string,
) {
  const questions: MetaQuestion[] = [
    ...mappingResult.prefilled,
    ...mappingResult.custom_questions,
  ];

  return {
    name,
    questions,
    privacy_policy: { url: privacyUrl },
    thank_you_page: {
      title: thankYou.title,
      body: thankYou.body,
    },
  };
}
