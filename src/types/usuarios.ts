export type UserType = 'admin' | 'manager' | 'user' | 'comercial';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  whatsapp?: string;
  tenant_id?: string;
  ativo: boolean;
  super_adm: boolean;
  user_type: UserType;
  agente?: string | null;
  auth_user_id?: string;
  created_at: string;
  updated_at: string;
}

// Subset usado por hooks legacy (useTimes, useAtribuicaoNegocio) e props.
// Para entidade completa, use Usuario.
export interface UsuarioBasico {
  id: string;
  nome?: string;
  name?: string;
  email?: string;
  ativo?: boolean;
  gestor?: boolean;
}

export interface UsuarioTime {
  id: string;
  usuario_id: string;
  time_id: string;
  created_at: string;
  time?: {
    id: string;
    nome: string;
    tipo: string;
    prioridade: number;
  };
  usuario?: {
    id: string;
    nome: string;
    email: string;
    gestor: boolean;
    super_adm: boolean;
  };
}
