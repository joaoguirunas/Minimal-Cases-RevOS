
-- Remover o campo intervalo_reserva da tabela crm_reservas_espacos
ALTER TABLE crm_reservas_espacos DROP COLUMN IF EXISTS intervalo_reserva;
