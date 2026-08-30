-- Atualizar o service_status das pessoas para que apareçam nas conversas
UPDATE clients_people 
SET service_status = 'aberto'
WHERE id IN (
  '1f863a2d-b572-47a2-8634-6e8bc56d01cc',  -- João Silva
  '83577fc0-5fb7-4ee2-8b6b-a325104b460d',  -- Rafaela
  '1d00a6a5-9f38-4fc1-b416-20511a7e3601'   -- Rafa
);