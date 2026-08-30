import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UsuariosConfig from './UsuariosConfig';
import TimesConfig from './TimesConfig';
import PermissoesConfig from './PermissoesConfig';

export default function UsuariosEquipesConfig() {
  const [tab, setTab] = useState('usuarios');
  return (
    <div className="space-y-5">
      <div className="pb-4 border-b border-border">
        <p className="text-[15px] font-semibold text-foreground leading-tight">Usuários e Equipes</p>
        <p className="text-[12px] text-muted-foreground mt-0.5">Gerencie usuários, permissões e equipes do workspace</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <TabsList className="h-[45px] w-full justify-start gap-0 bg-card dark:bg-zinc-950 border border-border rounded-[2px] p-0">
          <TabsTrigger value="usuarios" className="flex-1 text-[13px] h-full px-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Usuários
          </TabsTrigger>
          <TabsTrigger value="equipes" className="flex-1 text-[13px] h-full px-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Equipes
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="flex-1 text-[13px] h-full px-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
            Permissões
          </TabsTrigger>
        </TabsList>
        <TabsContent value="usuarios"><UsuariosConfig /></TabsContent>
        <TabsContent value="equipes"><TimesConfig /></TabsContent>
        <TabsContent value="permissoes"><PermissoesConfig /></TabsContent>
      </Tabs>
    </div>
  );
}
