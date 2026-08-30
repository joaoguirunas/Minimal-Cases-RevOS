
import { useState } from 'react';
import { UserPlus, Plus, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface AddMembersSectionProps {
  usuariosDisponiveis: Array<{
    id: string;
    nome: string;
    email: string;
    gestor: boolean;
    super_adm?: boolean;
  }>;
  selectedMembers: string[];
  onMemberToggle: (usuarioId: string) => void;
  onAddMembers: () => void;
  isLoading?: boolean;
}

const AddMembersSection = ({ 
  usuariosDisponiveis, 
  selectedMembers, 
  onMemberToggle, 
  onAddMembers,
  isLoading = false
}: AddMembersSectionProps) => {
  if (usuariosDisponiveis.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Adicionar Membros
          </div>
          {selectedMembers.length > 0 && (
            <Badge variant="secondary">
              {selectedMembers.length} selecionado{selectedMembers.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <ScrollArea className="max-h-80">
          <div className="space-y-2 pr-4">
            {usuariosDisponiveis.map((usuario) => (
              <div
                key={usuario.id}
                className={`flex items-center space-x-3 p-3 border rounded-[2px] cursor-pointer transition-all hover:bg-muted ${
                  selectedMembers.includes(usuario.id)
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/30'
                }`}
                onClick={() => onMemberToggle(usuario.id)}
              >
                <Checkbox
                  checked={selectedMembers.includes(usuario.id)}
                  onCheckedChange={() => onMemberToggle(usuario.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-sm truncate">
                      {usuario.nome}
                    </p>
                    {usuario.super_adm && (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                        Super Admin
                      </Badge>
                    )}
                    {usuario.gestor && !usuario.super_adm && (
                      <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                        Gestor
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {usuario.email}
                  </p>
                </div>

                {selectedMembers.includes(usuario.id) && (
                  <UserCheck className="w-4 h-4 text-primary" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {selectedMembers.length > 0 && (
          <>
            <Separator />
            <div className="flex justify-end">
              <Button
                onClick={onAddMembers}
                disabled={isLoading}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                {isLoading ? 'Adicionando...' : `Adicionar ${selectedMembers.length} ${selectedMembers.length === 1 ? 'Membro' : 'Membros'}`}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AddMembersSection;
