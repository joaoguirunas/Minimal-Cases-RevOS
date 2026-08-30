
-- Adicionar campos para reserva total e intervalo na tabela de espaços
ALTER TABLE crm_reservas_espacos 
ADD COLUMN reserva_total boolean DEFAULT false,
ADD COLUMN intervalo_reserva integer DEFAULT 30;

-- Tornar o campo quantidade nullable na tabela de reservas
-- (já é nullable conforme a migration existente)

-- Adicionar comentários para documentar os novos campos
COMMENT ON COLUMN crm_reservas_espacos.reserva_total IS 'Define se o espaço deve ser reservado por completo (true) ou baseado na capacidade de pessoas (false)';
COMMENT ON COLUMN crm_reservas_espacos.intervalo_reserva IS 'Intervalo em minutos para as reservas (30, 60, 120, 180, 360, 720, 1440)';
