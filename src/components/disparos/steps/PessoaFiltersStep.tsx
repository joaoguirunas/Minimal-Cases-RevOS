import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { User, Award, ClipboardList } from 'lucide-react';
import { SendFilters } from '@/types/sends';
import { useScoreMatrix } from '@/hooks/useScoreMatrix';
import { useScoreFramings } from '@/hooks/useScoreFramings';
import { useScoreInvestments } from '@/hooks/useScoreInvestments';
import { useScoreObjectives } from '@/hooks/useScoreObjectives';
import MultiSelectFilter from '../MultiSelectFilter';

interface PessoaFiltersStepProps {
  filters: SendFilters;
  onFilterChange: (filters: Partial<SendFilters>) => void;
}

export default function PessoaFiltersStep({ 
  filters, 
  onFilterChange 
}: PessoaFiltersStepProps) {
  const { data: scoreMatrixes } = useScoreMatrix();
  const { data: framings } = useScoreFramings();
  const { data: investments } = useScoreInvestments();
  const { data: objectives } = useScoreObjectives();
  
  const countActiveFilters = (section: 'basic' | 'score' | 'questionnaire') => {
    const basicFields = ['name', 'email', 'person_status', 'service_status', 'accepts_calls', 'ai_enabled'];
    const scoreFields = ['score_matrix_id', 'score_framing_id', 'score_investment_id', 'score_objective_id'];
    const questionnaireFields = Object.keys(filters).filter(k => k.startsWith('q'));
    
    const fieldsToCheck = section === 'basic' ? basicFields : 
                          section === 'score' ? scoreFields : questionnaireFields;
    
    return fieldsToCheck.filter(key => {
      const value = filters[key as keyof SendFilters];
      return value !== undefined && value !== null && value !== '' && 
             (Array.isArray(value) ? value.length > 0 : true);
    }).length;
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[18px] font-semibold mb-2">Filtros de Pessoa</h3>
        <p className="text-sm text-muted-foreground">
          Aplique filtros detalhados sobre os dados pessoais (opcional)
        </p>
      </div>
      
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic" className="gap-2">
            <User className="w-4 h-4" />
            Dados Básicos
            {countActiveFilters('basic') > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {countActiveFilters('basic')}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="score" className="gap-2">
            <Award className="w-4 h-4" />
            Score
            {countActiveFilters('score') > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {countActiveFilters('score')}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="questionnaire" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Questionário
            {countActiveFilters('questionnaire') > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {countActiveFilters('questionnaire')}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
        
        {/* Tab 1: Dados Básicos */}
        <TabsContent value="basic" className="space-y-4">
          <Card className="border border-border bg-card rounded-[2px]">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Buscar por nome"
                    value={filters.name || ''}
                    onChange={(e) => onFilterChange({ name: e.target.value || undefined })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Buscar por email"
                    value={filters.email || ''}
                    onChange={(e) => onFilterChange({ email: e.target.value || undefined })}
                  />
                </div>
                
                <div>
                  <Label>Status da Pessoa</Label>
                  <MultiSelectFilter
                    label=""
                    options={[
                      { value: 'active', label: 'Ativo' },
                      { value: 'archived', label: 'Arquivado' }
                    ]}
                    selected={filters.person_status || []}
                    onChange={(values) => onFilterChange({ person_status: values as any })}
                  />
                </div>
                
                <div>
                  <Label>Status de Atendimento</Label>
                  <MultiSelectFilter
                    label=""
                    options={[
                      { value: 'open', label: 'Aberto' },
                      { value: 'closed', label: 'Fechado' }
                    ]}
                    selected={filters.service_status || []}
                    onChange={(values) => onFilterChange({ service_status: values as any })}
                  />
                </div>
                
                <div>
                  <Label htmlFor="accepts_calls">Aceita Ligações</Label>
                  <Select
                    value={filters.accepts_calls === undefined ? 'todos' : filters.accepts_calls ? 'sim' : 'nao'}
                    onValueChange={(value) => onFilterChange({ 
                      accepts_calls: value === 'todos' ? undefined : value === 'sim' 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="ai_enabled">IA Habilitada</Label>
                  <Select
                    value={filters.ai_enabled === undefined ? 'todos' : filters.ai_enabled ? 'sim' : 'nao'}
                    onValueChange={(value) => onFilterChange({ 
                      ai_enabled: value === 'todos' ? undefined : value === 'sim' 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab 2: Score */}
        <TabsContent value="score" className="space-y-4">
          <Card className="border border-border bg-card rounded-[2px]">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="score_matrix_id">Matriz de Score</Label>
                  <Select
                    value={filters.score_matrix_id || 'todos'}
                    onValueChange={(value) => onFilterChange({ score_matrix_id: value === 'todos' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as matrizes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas as matrizes</SelectItem>
                      {scoreMatrixes?.map((matrix) => (
                        <SelectItem key={matrix.id} value={matrix.id}>
                          Score {matrix.score_number} - {matrix.profile_score || 'Perfil'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="framing">Enquadramento</Label>
                  <Select
                    value={filters.score_framing_id || 'todos'}
                    onValueChange={(value) => onFilterChange({ score_framing_id: value === 'todos' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {framings?.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="income">Renda</Label>
                  <Select
                    value={filters.score_investment_id || 'todos'}
                    onValueChange={(value) => onFilterChange({ score_investment_id: value === 'todos' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {investments?.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="objective">Objetivo</Label>
                  <Select
                    value={filters.score_objective_id || 'todos'}
                    onValueChange={(value) => onFilterChange({ score_objective_id: value === 'todos' ? undefined : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {objectives?.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tab 3: Questionário */}
        <TabsContent value="questionnaire" className="space-y-4">
          <Card className="border border-border bg-card rounded-[2px]">
            <CardContent className="p-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Filtros do questionário não implementados nesta versão. Você pode adicionar campos conforme necessário.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
