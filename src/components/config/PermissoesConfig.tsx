import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Trash2, Shield, Lock } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useTenantRoles,
  useAllRolePermissions,
  useCreateTenantRole,
  useDeleteTenantRole,
  useUpdateRolePermission,
  ALL_FEATURE_KEYS,
  FEATURE_LABELS,
  type TenantRole,
  type FeatureKey,
} from '@/hooks/usePermissions';

// ── Section header ────────────────────────────────────────────────────────────
const SectionHeader = ({ title }: { title: string }) => (
  <div className="px-5 py-2.5 bg-muted border-b border-border">
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{title}</p>
  </div>
);

// ── Permission toggle cell ────────────────────────────────────────────────────
function PermCell({
  roleId,
  featureKey,
  enabled,
  isSystem,
}: {
  roleId: string;
  featureKey: FeatureKey;
  enabled: boolean;
  isSystem: boolean;
}) {
  const update = useUpdateRolePermission();
  return (
    <Switch
      checked={enabled}
      disabled={isSystem || update.isPending}
      onCheckedChange={(checked) =>
        update.mutate({ roleId, featureKey, enabled: checked })
      }
      className="data-[state=checked]:bg-primary"
    />
  );
}

// ── New role form ─────────────────────────────────────────────────────────────
function NewRoleForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useCreateTenantRole();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), description: description.trim() || undefined });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4 border-b border-border bg-muted/30 space-y-3">
      <p className="text-[12px] font-medium text-foreground">Nova role customizada</p>
      <div className="flex gap-2">
        <Input
          placeholder="Nome da role (ex: supervisor)"
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-8 text-xs flex-1"
          maxLength={40}
          autoFocus
        />
        <Input
          placeholder="Descrição (opcional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="h-8 text-xs flex-1"
          maxLength={80}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={!name.trim() || create.isPending}>
          {create.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          Criar
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
const PermissoesConfig = () => {
  const { data: roles, isLoading: rolesLoading } = useTenantRoles();
  const { data: allPerms, isLoading: permsLoading } = useAllRolePermissions();
  const deleteRole = useDeleteTenantRole();
  const [showNewForm, setShowNewForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TenantRole | null>(null);

  const isLoading = rolesLoading || permsLoading;

  // Build lookup: roleId → featureKey → enabled
  const permMap = new Map<string, Map<FeatureKey, boolean>>();
  for (const p of allPerms ?? []) {
    if (!permMap.has(p.role_id)) permMap.set(p.role_id, new Map());
    permMap.get(p.role_id)!.set(p.feature_key, p.enabled);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayRoles = roles ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Permissões por Role</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Defina o que cada role pode acessar. Roles do sistema não podem ser editadas.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowNewForm(true)}
          disabled={showNewForm}
        >
          <Plus className="w-3.5 h-3.5" />
          Nova role
        </Button>
      </div>

      {/* New role form */}
      {showNewForm && (
        <div className="border border-border rounded-[4px] overflow-hidden">
          <NewRoleForm onClose={() => setShowNewForm(false)} />
        </div>
      )}

      {/* Permissions matrix */}
      <div className="border border-border rounded-[4px] overflow-hidden">
        <SectionHeader title="Matriz de Permissões" />

        {/* Column headers = roles */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-5 py-3 text-[11px] font-medium text-muted-foreground w-56">
                  Funcionalidade
                </th>
                {displayRoles.map(role => (
                  <th key={role.id} className="px-4 py-3 text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1">
                        {role.is_system && <Lock className="w-3 h-3 text-muted-foreground/50" />}
                        <span className="text-[12px] font-medium text-foreground capitalize">
                          {role.name}
                        </span>
                      </div>
                      {role.description && (
                        <span className="text-[10px] text-muted-foreground">{role.description}</span>
                      )}
                      {!role.is_system && (
                        <button
                          onClick={() => setConfirmDelete(role)}
                          className="text-red-400/60 hover:text-red-400 transition-colors mt-0.5"
                          title="Remover role"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_FEATURE_KEYS.map((fk, idx) => {
                const { label, description } = FEATURE_LABELS[fk];
                return (
                  <tr
                    key={fk}
                    className={`border-b border-border last:border-0 ${idx % 2 === 0 ? '' : 'bg-muted/20'}`}
                  >
                    <td className="px-5 py-3">
                      <p className="text-[12px] font-medium text-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{description}</p>
                    </td>
                    {displayRoles.map(role => {
                      const enabled = role.is_system
                        ? (role.name === 'gestor' ? true : (permMap.get(role.id)?.get(fk) ?? false))
                        : (permMap.get(role.id)?.get(fk) ?? false);
                      return (
                        <td key={role.id} className="px-4 py-3 text-center">
                          {role.is_system && role.name === 'gestor' ? (
                            <div className="flex justify-center">
                              <Badge className="text-[9px] h-4 bg-green-400/10 text-green-400 border-green-400/20 border font-medium">
                                Sempre
                              </Badge>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <PermCell
                                roleId={role.id}
                                featureKey={fk}
                                enabled={enabled}
                                isSystem={role.is_system}
                              />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {displayRoles.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Shield className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-[13px] text-muted-foreground">Nenhuma role configurada</p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Use o botão "Nova role" para criar a primeira, ou acesse Configurações {'>'} Usuários para que um gestor ative as permissões padrão.
            </p>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover role "{confirmDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os usuários com esta role perderão as permissões customizadas e voltarão ao comportamento padrão.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={async () => {
                if (confirmDelete) {
                  await deleteRole.mutateAsync(confirmDelete.id);
                  setConfirmDelete(null);
                }
              }}
            >
              {deleteRole.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PermissoesConfig;
