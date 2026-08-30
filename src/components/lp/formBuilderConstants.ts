import type { LpFormField, LpFormSettings } from "@/hooks/useLpForms";

// ─── Constants ────────────────────────────────────────────────────────────────

export const UTM_FIELDS: LpFormField[] = [
  { id: "utm-source",   type: "hidden", label: "utm_source",   placeholder: "", required: false, crm_field: "utm.source",   conditions: [], order: 1000 },
  { id: "utm-medium",   type: "hidden", label: "utm_medium",   placeholder: "", required: false, crm_field: "utm.medium",   conditions: [], order: 1001 },
  { id: "utm-campaign", type: "hidden", label: "utm_campaign", placeholder: "", required: false, crm_field: "utm.campaign", conditions: [], order: 1002 },
  { id: "utm-content",  type: "hidden", label: "utm_content",  placeholder: "", required: false, crm_field: "utm.content",  conditions: [], order: 1003 },
  { id: "utm-term",     type: "hidden", label: "utm_term",     placeholder: "", required: false, crm_field: "utm.term",     conditions: [], order: 1004 },
];

export const DEFAULT_SETTINGS: LpFormSettings = {
  submit_text: "Enviar",
  success_message: "Obrigado! Entraremos em contato em breve.",
  redirect_url: "",
  mode: "classic",
};

export const TEMPLATES = [
  {
    label: "Nome + E-mail",
    fields: (): LpFormField[] => [
      { id: crypto.randomUUID(), type: "text",  label: "Nome",   placeholder: "Seu nome completo", required: true,  crm_field: "pessoa.nome",     conditions: [], order: 0 },
      { id: crypto.randomUUID(), type: "email", label: "E-mail", placeholder: "seu@email.com",     required: true,  crm_field: "pessoa.email",    conditions: [], order: 1 },
      // UTMs are captured natively by PublicFormPage
    ],
  },
  {
    label: "Nome + WhatsApp + E-mail",
    fields: (): LpFormField[] => [
      { id: crypto.randomUUID(), type: "text",  label: "Nome",     placeholder: "Seu nome completo", required: true,  crm_field: "pessoa.nome",     conditions: [], order: 0 },
      { id: crypto.randomUUID(), type: "phone", label: "WhatsApp", placeholder: "(11) 99999-9999",   required: true,  crm_field: "pessoa.whatsapp", conditions: [], order: 1 },
      { id: crypto.randomUUID(), type: "email", label: "E-mail",   placeholder: "seu@email.com",     required: false, crm_field: "pessoa.email",    conditions: [], order: 2 },
      // UTMs are captured natively by PublicFormPage
    ],
  },
  {
    label: "Contato completo",
    fields: (): LpFormField[] => [
      { id: crypto.randomUUID(), type: "text",  label: "Nome",     placeholder: "Seu nome completo", required: true,  crm_field: "pessoa.nome",     conditions: [], order: 0 },
      { id: crypto.randomUUID(), type: "email", label: "E-mail",   placeholder: "seu@email.com",     required: true,  crm_field: "pessoa.email",    conditions: [], order: 1 },
      { id: crypto.randomUUID(), type: "phone", label: "WhatsApp", placeholder: "(11) 99999-9999",   required: true,  crm_field: "pessoa.whatsapp", conditions: [], order: 2 },
      { id: crypto.randomUUID(), type: "text",  label: "Empresa",  placeholder: "Nome da empresa",   required: false, crm_field: "empresa.nome",    conditions: [], order: 3 },
      // UTMs are captured natively by PublicFormPage
    ],
  },
  {
    label: "Só WhatsApp",
    fields: (): LpFormField[] => [
      { id: crypto.randomUUID(), type: "text",  label: "Nome",     placeholder: "Seu nome",        required: true, crm_field: "pessoa.nome",     conditions: [], order: 0 },
      { id: crypto.randomUUID(), type: "phone", label: "WhatsApp", placeholder: "(11) 99999-9999", required: true, crm_field: "pessoa.whatsapp", conditions: [], order: 1 },
      // UTMs are captured natively by PublicFormPage
    ],
  },
  {
    label: "Lead B2B",
    fields: (): LpFormField[] => [
      { id: crypto.randomUUID(), type: "text",  label: "Nome",     placeholder: "Seu nome completo",  required: true,  crm_field: "pessoa.nome",     conditions: [], order: 0 },
      { id: crypto.randomUUID(), type: "phone", label: "WhatsApp", placeholder: "(11) 99999-9999",    required: true,  crm_field: "pessoa.whatsapp", conditions: [], order: 1 },
      { id: crypto.randomUUID(), type: "text",  label: "Cargo",    placeholder: "Seu cargo",          required: false, crm_field: "custom.cargo",    conditions: [], order: 2 },
      { id: crypto.randomUUID(), type: "text",  label: "Empresa",  placeholder: "Nome da empresa",    required: false, crm_field: "empresa.nome",    conditions: [], order: 3 },
      // UTMs are captured natively by PublicFormPage
    ],
  },
  {
    label: "Evento / Webinar",
    fields: (): LpFormField[] => [
      { id: crypto.randomUUID(), type: "text",  label: "Nome",     placeholder: "Seu nome completo", required: true,  crm_field: "pessoa.nome",     conditions: [], order: 0 },
      { id: crypto.randomUUID(), type: "email", label: "E-mail",   placeholder: "seu@email.com",     required: true,  crm_field: "pessoa.email",    conditions: [], order: 1 },
      { id: crypto.randomUUID(), type: "text",  label: "Empresa",  placeholder: "Nome da empresa",   required: false, crm_field: "empresa.nome",    conditions: [], order: 2 },
      { id: crypto.randomUUID(), type: "text",  label: "Cargo",    placeholder: "Seu cargo",         required: false, crm_field: "custom.cargo",    conditions: [], order: 3 },
      // UTMs are captured natively by PublicFormPage
    ],
  },
  {
    label: "Newsletter",
    fields: (): LpFormField[] => [
      { id: crypto.randomUUID(), type: "text",  label: "Nome",   placeholder: "Seu nome", required: true, crm_field: "pessoa.nome",  conditions: [], order: 0 },
      { id: crypto.randomUUID(), type: "email", label: "E-mail", placeholder: "seu@email.com", required: true, crm_field: "pessoa.email", conditions: [], order: 1 },
      // UTMs are captured natively by PublicFormPage
    ],
  },
  {
    label: "Pesquisa de Satisfação",
    fields: (): LpFormField[] => [
      { id: crypto.randomUUID(), type: "text",     label: "Nome",       placeholder: "Seu nome",       required: false, crm_field: "pessoa.nome",   conditions: [], order: 0 },
      { id: crypto.randomUUID(), type: "email",    label: "E-mail",     placeholder: "seu@email.com",  required: false, crm_field: "pessoa.email",  conditions: [], order: 1 },
      { id: crypto.randomUUID(), type: "select",   label: "Avaliação",  placeholder: "",               required: true,  crm_field: "",              conditions: [], order: 2,
        options: [
          { value: "5", label: "⭐⭐⭐⭐⭐ Excelente", tags: [] },
          { value: "4", label: "⭐⭐⭐⭐ Bom",         tags: [] },
          { value: "3", label: "⭐⭐⭐ Regular",       tags: [] },
          { value: "2", label: "⭐⭐ Ruim",            tags: [] },
          { value: "1", label: "⭐ Péssimo",          tags: [] },
        ],
      },
      { id: crypto.randomUUID(), type: "textarea", label: "Comentários", placeholder: "Deixe seu comentário...", required: false, crm_field: "", conditions: [], order: 3 },
      // UTMs are captured natively by PublicFormPage
    ],
  },
  {
    label: "Qualificação Completa",
    fields: (): LpFormField[] => [
      { id: crypto.randomUUID(), type: "text",   label: "Nome",     placeholder: "Seu nome completo", required: true,  crm_field: "pessoa.nome",     conditions: [], order: 0 },
      { id: crypto.randomUUID(), type: "phone",  label: "WhatsApp", placeholder: "(11) 99999-9999",   required: true,  crm_field: "pessoa.whatsapp", conditions: [], order: 1 },
      { id: crypto.randomUUID(), type: "email",  label: "E-mail",   placeholder: "seu@email.com",     required: false, crm_field: "pessoa.email",    conditions: [], order: 2 },
      { id: crypto.randomUUID(), type: "text",   label: "Empresa",  placeholder: "Nome da empresa",   required: false, crm_field: "empresa.nome",    conditions: [], order: 3 },
      { id: crypto.randomUUID(), type: "select", label: "Gargalo",  placeholder: "",                  required: false, crm_field: "",                conditions: [], order: 4,
        options: [
          { value: "leads", label: "Geração de leads",          tags: [] },
          { value: "vendas", label: "Conversão / Vendas",       tags: [] },
          { value: "retencao", label: "Retenção de clientes",   tags: [] },
          { value: "processos", label: "Processos internos",    tags: [] },
          { value: "outro", label: "Outro",                     tags: [] },
        ],
      },
      { id: crypto.randomUUID(), type: "select", label: "Budget",   placeholder: "",                  required: false, crm_field: "",                conditions: [], order: 5,
        options: [
          { value: "ate1k",    label: "Até R$ 1.000/mês",      tags: [] },
          { value: "1k-5k",    label: "R$ 1.000 – 5.000/mês",  tags: [] },
          { value: "5k-20k",   label: "R$ 5.000 – 20.000/mês", tags: [] },
          { value: "acima20k", label: "Acima de R$ 20.000/mês", tags: [] },
        ],
      },
      // UTMs are captured natively by PublicFormPage
    ],
  },
];
