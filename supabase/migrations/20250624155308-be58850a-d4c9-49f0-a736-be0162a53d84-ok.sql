
-- Remover a tabela usuario_clientes, já que agora temos usuários unificados
-- com tipo_usuario definido diretamente na tabela usuarios
DROP TABLE IF EXISTS public.usuario_clientes;
