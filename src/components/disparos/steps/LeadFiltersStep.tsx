import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserCircle, DollarSign, Calendar, Hash, Target } from 'lucide-react';
import { SendFilters } from '@/types/sends';
import type { UsuarioBasico as Usuario } from '@/types/usuarios';
import MultiSelectFilter from '../MultiSelectFilter';

interface Time {
  id: string;
  nome: string;
}

interface LeadFiltersStepProps {
  usuarios: Usuario[];
  times: Time[];
  filters: SendFilters;
  onFilterChange: (filters: Partial<SendFilters>) => void;
}

export default function LeadFiltersStep({ 
  usuarios, 
  times,
  filters, 
  onFilterChange 
}: LeadFiltersStepProps) {
  const activeFiltersCount = Object.keys(filters).filter(key => {
    const value = filters[key as keyof SendFilters];
    return value !== undefined && value !== null && value !== '' && 
           (Array.isArray(value) ? value.length > 0 : true);
  }).length;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[18px] font-['Outfit'] font-semibold mb-2">Filtros de Lead</h3>
          <p className="text-sm text-muted-foreground">
            Refine a busca com filtros relacionados aos negócios (opcional)
          </p>
        </div>
        
        {activeFiltersCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <Target className="w-3 h-3" />
            {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro ativo' : 'filtros ativos'}
          </Badge>
        )}
      </div>
      
      {/* Responsabilidade */}
      <Card className="border border-border bg-card rounded-[2px]">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-[4px] bg-blue-500/10">
              <UserCircle className="w-4 h-4 text-blue-600" />
            </div>
            <h4 className="font-['Outfit'] font-semibold">Responsabilidade</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Usuários Responsáveis</Label>
              <MultiSelectFilter
                label=""
                options={usuarios?.map(u => ({
                  value: u.id,
                  label: u.nome || u.name || 'Sem nome'
                })) || []}
                selected={filters.user_id || []}
                onChange={(values) => onFilterChange({ user_id: values.length > 0 ? values : undefined })}
              />
            </div>
            
            <div>
              <Label>Times Responsáveis</Label>
              <MultiSelectFilter
                label=""
                options={times?.map(t => ({
                  value: t.id,
                  label: t.nome
                })) || []}
                selected={filters.team_id || []}
                onChange={(values) => onFilterChange({ team_id: values.length > 0 ? values : undefined })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Status e Valor */}
      <Card className="border border-border bg-card rounded-[2px]">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-[4px] bg-green-500/10">
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
            <h4 className="font-['Outfit'] font-semibold">Status e Valor</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Status do Lead</Label>
              <MultiSelectFilter
                label=""
                options={[
                  { value: 'in_progress', label: 'Em Andamento' },
                  { value: 'won', label: 'Ganho' },
                  { value: 'lost', label: 'Perdido' }
                ]}
                selected={filters.lead_status || []}
                onChange={(values) => onFilterChange({ lead_status: values as any })}
              />
            </div>
            
            <div>
              <Label htmlFor="valor_min">Valor do Negócio (Mínimo)</Label>
              <Input
                id="valor_min"
                type="number"
                placeholder="R$ 0,00"
                value={filters.value_min || ''}
                onChange={(e) => onFilterChange({ value_min: e.target.value ? parseFloat(e.target.value) : undefined })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* UTM e Rastreamento */}
      <Card className="border border-border bg-card rounded-[2px]">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-[4px] bg-purple-500/10">
              <Hash className="w-4 h-4 text-purple-600" />
            </div>
            <h4 className="font-['Outfit'] font-semibold">UTM e Rastreamento</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="utm_source">UTM Source</Label>
              <Input
                id="utm_source"
                placeholder="Ex: google, facebook"
                value={filters.utm_source || ''}
                onChange={(e) => onFilterChange({ utm_source: e.target.value || undefined })}
              />
            </div>
            
            <div>
              <Label htmlFor="utm_campaign">UTM Campaign</Label>
              <Input
                id="utm_campaign"
                placeholder="Ex: spring_sale"
                value={filters.utm_campaign || ''}
                onChange={(e) => onFilterChange({ utm_campaign: e.target.value || undefined })}
              />
            </div>
            
            <div>
              <Label htmlFor="utm_medium">UTM Medium</Label>
              <Input
                id="utm_medium"
                placeholder="Ex: cpc, email"
                value={filters.utm_medium || ''}
                onChange={(e) => onFilterChange({ utm_medium: e.target.value || undefined })}
              />
            </div>
            
            <div>
              <Label htmlFor="utm_campaign">UTM Campaign</Label>
              <Input
                id="utm_campaign"
                placeholder="Ex: spring_sale"
                value={filters.utm_campaign || ''}
                onChange={(e) => onFilterChange({ utm_campaign: e.target.value || undefined })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Datas */}
      <Card className="border border-border bg-card rounded-[2px]">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 rounded-[4px] bg-orange-500/10">
              <Calendar className="w-4 h-4 text-orange-600" />
            </div>
            <h4 className="font-['Outfit'] font-semibold">Período</h4>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="data_inicio">Data Início</Label>
              <Input
                id="data_inicio"
                type="date"
                value={filters.created_from || ''}
                onChange={(e) => onFilterChange({ created_from: e.target.value || undefined })}
              />
            </div>
            
            <div>
              <Label htmlFor="data_fim">Data Fim</Label>
              <Input
                id="data_fim"
                type="date"
                value={filters.created_to || ''}
                onChange={(e) => onFilterChange({ created_to: e.target.value || undefined })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
