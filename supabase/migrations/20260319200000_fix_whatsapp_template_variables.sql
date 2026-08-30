-- Fix WhatsApp template variable mapping for lembrete_reuniao and ausencia_imediato
-- Bug: templates used {{2}} expecting time, but variable mapping sends {{2}}=date, {{3}}=time
-- Fix: update template body to use {{2}} for date and {{3}} for time (matching confirmacao_reuniao pattern)

-- Fix lembrete_reuniao
UPDATE whatsapp_templates
SET json_data = jsonb_set(
  json_data,
  '{components}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN comp->>'type' = 'BODY'
        THEN jsonb_set(
          jsonb_set(
            comp,
            '{text}',
            '"Olá {{1}}, este é um lembrete da sua reunião do dia {{2}} às {{3}}.\n\nNos vemos em breve!"'::jsonb
          ),
          '{example,body_text}',
          '[["Maria Santos", "20/03/2026", "14:00"]]'::jsonb
        )
        ELSE comp
      END
    )
    FROM jsonb_array_elements(json_data->'components') AS comp
  )
),
updated_at = now()
WHERE meta_template_name = 'lembrete_reuniao';

-- Fix ausencia_imediato
UPDATE whatsapp_templates
SET json_data = jsonb_set(
  json_data,
  '{components}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN comp->>'type' = 'BODY'
        THEN jsonb_set(
          jsonb_set(
            comp,
            '{text}',
            '"Olá {{1}}, sentimos sua falta na reunião do dia {{2}} às {{3}}. Sabemos que imprevistos acontecem! Que tal reagendar para um horário que funcione melhor para você?"'::jsonb
          ),
          '{example,body_text}',
          '[["Carlos Pereira", "20/03/2026", "14:00"]]'::jsonb
        )
        ELSE comp
      END
    )
    FROM jsonb_array_elements(json_data->'components') AS comp
  )
),
updated_at = now()
WHERE meta_template_name = 'ausencia_imediato';
