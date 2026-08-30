-- Inserir André Mazoni na tabela crm_usuarios
INSERT INTO crm_usuarios (
  auth_user_id,
  nome,
  email,
  super_adm,
  gestor,
  ativo,
  tenant_id,
  created_at,
  updated_at
) VALUES (
  '0a50d19c-7c4d-4653-bfaa-cbda2971e825',
  'André Mazoni',
  'mazoni.andre@gmail.com',
  true,
  true,
  true,
  null,
  now(),
  now()
);

-- Associar André Mazoni com a agência Iatize
INSERT INTO crm_agencia_usuarios (
  usuario_id,
  agencia_id,
  created_at
) VALUES (
  (SELECT id FROM crm_usuarios WHERE auth_user_id = '0a50d19c-7c4d-4653-bfaa-cbda2971e825'),
  'a16a9e4c-cc75-4d2c-8a9f-bafa6e7521fc',
  now()
);