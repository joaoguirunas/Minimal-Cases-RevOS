-- Create initial tenant and update user
INSERT INTO crm_tenants (id, name, value, ativo) 
VALUES (
  gen_random_uuid(),
  'Receita Previsível',
  'receita-previsivel', 
  true
);

-- Update the user to be super admin so they can manage the system
UPDATE crm_usuarios 
SET super_adm = true, gestor = true
WHERE email = 'joao@receitaprevisivel.ai';