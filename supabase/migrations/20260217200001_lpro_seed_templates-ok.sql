-- LP PRO™ — Seed Global Templates
-- LPRO-2.1: 5 conversion-optimized templates
-- Created: 2026-02-17

INSERT INTO public.lp_templates (name, category, thumbnail_url, content, is_global) VALUES

-- =============================================================================
-- 1. Lead Capture (Minimal)
-- Focus: email/phone collection. Clean hero + features + form + social proof
-- =============================================================================
(
  'Captura de Lead',
  'lead_capture',
  null,
  '{
    "meta": { "title": "Capture seus leads com inteligência", "description": "" },
    "theme": { "primary_color": "#0f172a", "accent_color": "#22c55e", "font_family": "Inter" },
    "blocks": [
      {
        "id": "b1",
        "type": "hero",
        "order": 0,
        "data": {
          "headline": "[Sua Proposta de Valor Aqui]",
          "subheading": "Descubra como podemos transformar seus resultados.",
          "cta_text": "Quero começar agora",
          "cta_action": "scroll_to_form",
          "background_color": "#0f172a",
          "text_color": "#ffffff"
        }
      },
      {
        "id": "b2",
        "type": "features",
        "order": 1,
        "data": {
          "columns": 3,
          "items": [
            { "icon": "CheckCircle", "title": "Benefício 1", "description": "Descreva o principal benefício aqui." },
            { "icon": "Zap", "title": "Benefício 2", "description": "Descreva o segundo benefício aqui." },
            { "icon": "Shield", "title": "Benefício 3", "description": "Descreva o terceiro benefício aqui." }
          ]
        }
      },
      {
        "id": "b3",
        "type": "form",
        "order": 2,
        "data": { "form_id": null, "headline": "Preencha e receba o acesso" }
      },
      {
        "id": "b4",
        "type": "social_proof",
        "order": 3,
        "data": {
          "stats": [
            { "value": "500+", "label": "Clientes atendidos" },
            { "value": "98%", "label": "Satisfação" },
            { "value": "3x", "label": "Crescimento médio" }
          ]
        }
      }
    ]
  }',
  true
),

-- =============================================================================
-- 2. Consultation Booking
-- Focus: value proposition + testimonial + form → unlock SCHEDULE PRO™
-- =============================================================================
(
  'Agendamento de Consultoria',
  'consultation',
  null,
  '{
    "meta": { "title": "Agende sua consultoria gratuita", "description": "" },
    "theme": { "primary_color": "#1e40af", "accent_color": "#f59e0b", "font_family": "Inter" },
    "blocks": [
      {
        "id": "b1",
        "type": "hero",
        "order": 0,
        "data": {
          "headline": "Consultoria Gratuita: [Tema da Consultoria]",
          "subheading": "Em 30 minutos, você vai entender exatamente o que precisa para [resultado desejado].",
          "cta_text": "Quero minha consultoria",
          "cta_action": "scroll_to_form",
          "background_color": "#1e40af",
          "text_color": "#ffffff"
        }
      },
      {
        "id": "b2",
        "type": "features",
        "order": 1,
        "data": {
          "columns": 2,
          "items": [
            { "icon": "Target", "title": "O que você vai descobrir", "description": "Diagnóstico personalizado da sua situação atual." },
            { "icon": "TrendingUp", "title": "Plano de ação", "description": "Estratégia clara para atingir seus objetivos." }
          ]
        }
      },
      {
        "id": "b3",
        "type": "testimonial",
        "order": 2,
        "data": {
          "quote": "[Depoimento do seu cliente aqui. Quanto mais específico, melhor.]",
          "author_name": "Nome do Cliente",
          "author_title": "Cargo, Empresa"
        }
      },
      {
        "id": "b4",
        "type": "form",
        "order": 3,
        "data": { "form_id": null, "headline": "Reservar minha vaga gratuita" }
      }
    ]
  }',
  true
),

-- =============================================================================
-- 3. Product Demo
-- Focus: feature highlights + video + demo request form
-- =============================================================================
(
  'Demo de Produto',
  'product_demo',
  null,
  '{
    "meta": { "title": "Veja o produto em ação", "description": "" },
    "theme": { "primary_color": "#7c3aed", "accent_color": "#10b981", "font_family": "Inter" },
    "blocks": [
      {
        "id": "b1",
        "type": "hero",
        "order": 0,
        "data": {
          "headline": "[Nome do Produto]: [Tagline Principal]",
          "subheading": "Veja como funciona na prática e descubra se é a solução certa para você.",
          "cta_text": "Ver demonstração",
          "cta_action": "scroll_to_form",
          "background_color": "#7c3aed",
          "text_color": "#ffffff"
        }
      },
      {
        "id": "b2",
        "type": "video",
        "order": 1,
        "data": {
          "url": "",
          "caption": "Assista ao vídeo demonstrativo"
        }
      },
      {
        "id": "b3",
        "type": "features",
        "order": 2,
        "data": {
          "columns": 3,
          "items": [
            { "icon": "Layers", "title": "Funcionalidade 1", "description": "Descreva aqui." },
            { "icon": "BarChart2", "title": "Funcionalidade 2", "description": "Descreva aqui." },
            { "icon": "Users", "title": "Funcionalidade 3", "description": "Descreva aqui." }
          ]
        }
      },
      {
        "id": "b4",
        "type": "form",
        "order": 3,
        "data": { "form_id": null, "headline": "Solicitar demonstração personalizada" }
      }
    ]
  }',
  true
),

-- =============================================================================
-- 4. Event Registration
-- Focus: event details + countdown + registration form
-- =============================================================================
(
  'Inscrição em Evento',
  'event_registration',
  null,
  '{
    "meta": { "title": "Garanta sua vaga no evento", "description": "" },
    "theme": { "primary_color": "#dc2626", "accent_color": "#fbbf24", "font_family": "Inter" },
    "blocks": [
      {
        "id": "b1",
        "type": "hero",
        "order": 0,
        "data": {
          "headline": "[Nome do Evento]",
          "subheading": "[Data] | [Horário] | [Local/Online]",
          "cta_text": "Garantir minha vaga",
          "cta_action": "scroll_to_form",
          "background_color": "#dc2626",
          "text_color": "#ffffff"
        }
      },
      {
        "id": "b2",
        "type": "countdown",
        "order": 1,
        "data": {
          "target_date": "",
          "label": "O evento começa em"
        }
      },
      {
        "id": "b3",
        "type": "features",
        "order": 2,
        "data": {
          "columns": 2,
          "items": [
            { "icon": "Calendar", "title": "Programação", "description": "Descreva a agenda do evento." },
            { "icon": "Users", "title": "Palestrantes", "description": "Quem vai apresentar." }
          ]
        }
      },
      {
        "id": "b4",
        "type": "form",
        "order": 3,
        "data": { "form_id": null, "headline": "Fazer minha inscrição" }
      }
    ]
  }',
  true
),

-- =============================================================================
-- 5. Webinar
-- Focus: speaker bio + agenda + registration form
-- =============================================================================
(
  'Webinar',
  'webinar',
  null,
  '{
    "meta": { "title": "Participe do webinar gratuito", "description": "" },
    "theme": { "primary_color": "#0891b2", "accent_color": "#f97316", "font_family": "Inter" },
    "blocks": [
      {
        "id": "b1",
        "type": "hero",
        "order": 0,
        "data": {
          "headline": "Webinar Gratuito: [Tema do Webinar]",
          "subheading": "[Data] às [Horário] | Ao vivo pelo Zoom",
          "cta_text": "Reservar minha vaga grátis",
          "cta_action": "scroll_to_form",
          "background_color": "#0891b2",
          "text_color": "#ffffff"
        }
      },
      {
        "id": "b2",
        "type": "features",
        "order": 1,
        "data": {
          "columns": 2,
          "items": [
            { "icon": "BookOpen", "title": "O que você vai aprender", "description": "Tópico 1 do webinar." },
            { "icon": "Mic", "title": "Sobre o palestrante", "description": "[Nome] — [Cargo/especialidade]." }
          ]
        }
      },
      {
        "id": "b3",
        "type": "countdown",
        "order": 2,
        "data": {
          "target_date": "",
          "label": "O webinar começa em"
        }
      },
      {
        "id": "b4",
        "type": "form",
        "order": 3,
        "data": { "form_id": null, "headline": "Quero participar gratuitamente" }
      },
      {
        "id": "b5",
        "type": "social_proof",
        "order": 4,
        "data": {
          "stats": [
            { "value": "1.200+", "label": "Já confirmaram presença" },
            { "value": "4.8/5", "label": "Avaliação média" }
          ]
        }
      }
    ]
  }',
  true
);
