import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Plus, Edit, Shield, ShieldCheck, Trash2, UserCircle, RefreshCw, Calendar, Video, ShieldOff } from 'lucide-react';
import { useUsers, useUpdateUser, useDeleteUser, type User } from '@/hooks/useUsersNew';
import NovoUsuarioModal from '@/components/modals/NovoUsuarioModal';
import EditarUsuarioModal from '@/components/modals/EditarUsuarioModal';
import { ConfirmarExclusaoModal } from '@/components/modals/ConfirmarExclusaoModal';
import StandardPageLoader from '@/components/loading/StandardPageLoader';
import { Usuario, UserType } from '@/types/usuarios';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useTranslation } from '@/hooks/useTranslation';
import { useCalendarSyncStatus } from '@/hooks/useCalendarSyncStatus';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useSettings } from '@/hooks/useSettings';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type UserRow = User & { user_type?: UserType };

export const UsuariosConfig = () => {
  const { t } = useTranslation();
  const [novoUsuarioOpen, setNovoUsuarioOpen] = useState(false);
  const [editarUsuarioOpen, setEditarUsuarioOpen] = useState(false);
  const [excluirUsuarioOpen, setExcluirUsuarioOpen] = useState(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);

  const { data: usuarios = [], isLoading, refetch, isFetching } = useUsers();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const { canCreateUser, canEditUser, canDeleteUser } = useUserPermissions();
  const { syncStatus } = useCalendarSyncStatus();
  const { data: settings } = useSettings();
  const [mfaRevokeTarget, setMfaRevokeTarget] = useState<{ id: string; auth_user_id: string; name: string } | null>(null);
  const [isRevokingMfa, setIsRevokingMfa] = useState(false);

  const handleRevokeMfa = async () => {
    if (!mfaRevokeTarget?.auth_user_id) return;
    setIsRevokingMfa(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-unenroll-mfa', {
        method: 'POST',
        body: { targetAuthUserId: mfaRevokeTarget.auth_user_id },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? 'Erro ao remover MFA');
      toast.success(`MFA removido de ${mfaRevokeTarget.name}`);
      setMfaRevokeTarget(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover MFA');
    } finally {
      setIsRevokingMfa(false);
    }
  };

  const resolveUserType = (usuario: UserRow): UserType => {
    if (usuario.user_type === 'admin' || usuario.user_type === 'manager' || usuario.user_type === 'user' || usuario.user_type === 'comercial') {
      return usuario.user_type;
    }
    if (usuario.is_super_admin || usuario.super_adm) return 'admin';
    if (usuario.is_manager || usuario.gestor) return 'manager';
    return 'user';
  };

  const handleEditUsuario = (usuario: UserRow) => {
    const user_type = resolveUserType(usuario);
    setUsuarioSelecionado({
      id: usuario.id,
      nome: usuario.name || usuario.nome || '',
      email: usuario.email,
      whatsapp: usuario.whatsapp,
      ativo: usuario.active || usuario.ativo || true,
      super_adm: user_type === 'admin' || usuario.is_super_admin || usuario.super_adm || false,
      user_type,
      agente: usuario.agente ?? null,
      auth_user_id: usuario.auth_user_id,
      created_at: usuario.created_at,
      updated_at: usuario.updated_at,
    } as Usuario);
    setEditarUsuarioOpen(true);
  };

  const handleSaveUsuario = async (usuario: Usuario) => {
    await updateUser.mutateAsync({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      whatsapp: usuario.whatsapp,
      user_type: usuario.user_type,
      gestor: usuario.user_type === 'manager' || usuario.user_type === 'admin',
      super_adm: usuario.user_type === 'admin' || usuario.super_adm,
      ativo: usuario.ativo,
      agente: (usuario.user_type === 'user' || usuario.user_type === 'comercial') ? (usuario.agente ?? null) : null,
    });
  };

  const handleExcluirUsuario = (usuario: UserRow) => {
    const user_type = resolveUserType(usuario);
    setUsuarioSelecionado({
      id: usuario.id,
      nome: usuario.name || usuario.nome || '',
      email: usuario.email,
      whatsapp: usuario.whatsapp,
      ativo: usuario.active || usuario.ativo || true,
      super_adm: user_type === 'admin' || usuario.is_super_admin || usuario.super_adm || false,
      user_type,
      auth_user_id: usuario.auth_user_id,
      created_at: usuario.created_at,
      updated_at: usuario.updated_at,
    } as Usuario);
    setExcluirUsuarioOpen(true);
  };

  const handleConfirmarExclusao = async () => {
    if (usuarioSelecionado) {
      await deleteUser.mutateAsync(usuarioSelecionado.id);
      setExcluirUsuarioOpen(false);
      setUsuarioSelecionado(null);
    }
  };

  if (isLoading) return <StandardPageLoader message="Carregando usuários…" />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <h1 className="text-[15px] font-semibold text-foreground">{t('usersConfig.title')}</h1>
          <p className="text-[13px] text-muted-foreground/70 mt-0.5">{t('usersConfig.description')}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-[30px] w-[30px] p-0 text-muted-foreground/60 hover:text-foreground rounded-lg"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} strokeWidth={1.5} />
          </Button>
          {canCreateUser && (
            <Button size="sm" onClick={() => setNovoUsuarioOpen(true)} className="gap-1.5 h-[30px] text-xs rounded-lg">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              {t('usersConfig.newUser')}
            </Button>
          )}
        </div>
      </div>

      {/* User list */}
      {usuarios.length === 0 ? (
        <div className="border border-border rounded-md p-8 text-center">
          <p className="text-[13px] text-muted-foreground/60 mb-3">
            {canCreateUser
              ? 'Nenhum usuário cadastrado. Crie o primeiro para começar.'
              : 'Nenhum usuário disponível. Contacte um administrador.'}
          </p>
          {canCreateUser && (
            <Button size="sm" onClick={() => setNovoUsuarioOpen(true)} className="gap-1.5 h-[30px] text-xs rounded-lg">
              <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
              Criar Primeiro Usuário
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-border rounded-md overflow-hidden">
          {usuarios.map((usuario, index) => {
            const nome = usuario.name || usuario.nome || '';
            const userType = resolveUserType(usuario);
            const isAtivo = usuario.active || usuario.ativo;
            const initials = nome.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
            const sync = syncStatus[usuario.id] ?? { google: false, microsoft: false };

            return (
              <div
                key={usuario.id}
                className={cn(
                  "flex items-center justify-between px-5 py-3.5 hover:bg-muted transition-colors",
                  index < usuarios.length - 1 && "border-b border-border"
                )}
              >
                {/* Avatar + info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-[30px] h-[30px] rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {initials || '?'}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-normal text-foreground truncate">{nome}</span>
                      {/* Role badge */}
                      {userType === 'admin' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-purple-600 dark:text-purple-400 bg-purple-500/8 border border-purple-200/30 px-1.5 py-0.5 rounded-full leading-none">
                          <ShieldCheck className="w-2.5 h-2.5" strokeWidth={1.5} />
                          Admin
                        </span>
                      ) : userType === 'manager' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/8 border border-blue-200/30 px-1.5 py-0.5 rounded-full leading-none">
                          <Shield className="w-2.5 h-2.5" strokeWidth={1.5} />
                          Manager
                        </span>
                      ) : userType === 'comercial' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/8 border border-amber-200/30 px-1.5 py-0.5 rounded-full leading-none">
                          <UserCircle className="w-2.5 h-2.5" strokeWidth={1.5} />
                          Comercial
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border border-emerald-200/30 px-1.5 py-0.5 rounded-full leading-none">
                          <UserCircle className="w-2.5 h-2.5" strokeWidth={1.5} />
                          User
                        </span>
                      )}
                      {!isAtivo && (
                        <span className="text-[10px] font-medium text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-full leading-none border border-border">
                          {t('common.inactive')}
                        </span>
                      )}
                      {sync.google && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/8 border border-emerald-200/30 px-1.5 py-0.5 rounded-full leading-none">
                          <Calendar className="w-2.5 h-2.5" strokeWidth={1.5} />
                          GCal
                        </span>
                      )}
                      {sync.microsoft && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-500/8 border border-blue-200/30 px-1.5 py-0.5 rounded-full leading-none">
                          <Video className="w-2.5 h-2.5" strokeWidth={1.5} />
                          Teams
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">
                      {usuario.email}
                      {usuario.whatsapp && <span className="ml-2">· {usuario.whatsapp}</span>}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                  {canEditUser && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditUsuario(usuario)}
                      className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-foreground"
                    >
                      <Edit className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                  )}
                  {canEditUser && settings?.require_mfa_for_gestores && usuario.auth_user_id && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Remover MFA de ${usuario.nome ?? usuario.name ?? ''}`}
                          onClick={() => setMfaRevokeTarget({ id: usuario.id, auth_user_id: usuario.auth_user_id, name: usuario.nome ?? usuario.name ?? '' })}
                          className="h-[28px] text-[11px] rounded-md text-amber-600 hover:text-amber-600 hover:bg-amber-500/10 gap-1 px-2"
                        >
                          <ShieldOff className="w-3 h-3" aria-hidden="true" strokeWidth={1.5} />
                          Remover MFA
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Remover autenticação em dois fatores</TooltipContent>
                    </Tooltip>
                  )}
                  {canDeleteUser && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExcluirUsuario(usuario)}
                      className="h-[30px] w-[30px] p-0 text-muted-foreground/50 hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <NovoUsuarioModal open={novoUsuarioOpen} onOpenChange={setNovoUsuarioOpen} />
      <EditarUsuarioModal
        open={editarUsuarioOpen}
        onOpenChange={setEditarUsuarioOpen}
        usuario={usuarioSelecionado}
        onSave={handleSaveUsuario}
      />
      <ConfirmarExclusaoModal
        open={excluirUsuarioOpen}
        onOpenChange={setExcluirUsuarioOpen}
        onConfirm={handleConfirmarExclusao}
        title="Excluir Usuário"
        description={`Excluir "${usuarioSelecionado?.nome}"? Esta ação não pode ser desfeita.`}
        isLoading={deleteUser.isPending}
      />
      <AlertDialog open={!!mfaRevokeTarget} onOpenChange={() => setMfaRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[15px]">
              Remover MFA de {mfaRevokeTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] leading-relaxed">
              Esta ação irá desativar o autenticador TOTP de{' '}
              <span className="font-semibold text-foreground">{mfaRevokeTarget?.name}</span>.
              Ela será registrada no audit_log.
              <br /><br />
              O usuário poderá configurar MFA novamente a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMfaRevokeTarget(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeMfa}
              disabled={isRevokingMfa}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isRevokingMfa ? 'Removendo...' : 'Remover MFA'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsuariosConfig;
