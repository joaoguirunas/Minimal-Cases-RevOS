-- FWUP-24: Migrar leads_stages_followups.control de INTEGER para TEXT
-- Valores: 1→'recomendacao', 2→'pessoal', 3→'evento', 4→'network', NULL→NULL
-- Motivo: inteiros são opacos para operadores; texto é autoexplicativo na UI e no DB.

ALTER TABLE leads_stages_followups
  ALTER COLUMN control TYPE text USING CASE control::text
    WHEN '1' THEN 'recomendacao'
    WHEN '2' THEN 'pessoal'
    WHEN '3' THEN 'evento'
    WHEN '4' THEN 'network'
    ELSE NULL
  END;

COMMENT ON COLUMN leads_stages_followups.control IS
  'Filtra follow-ups por origem do lead: recomendacao | pessoal | evento | network | NULL (universal)';
