import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Building2, Check, ChevronsUpDown, X } from 'lucide-react';
import { useAtualizarPessoaComplete } from '@/hooks/useAtualizarPessoaComplete';
import { usePipelines } from '@/hooks/usePipelines';
import { useTeams } from '@/hooks/useTeamsNew';
import { useCompanies } from '@/hooks/useCompanies';
import { usePeopleCompanies, useUpdatePeopleCompanies } from '@/hooks/usePeopleCompanies';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PersonScoreSection } from '@/components/common/PersonScoreSection';
import { cn } from '@/lib/utils';
import WhatsAppInput from '@/components/common/WhatsAppInput';
interface EditarPessoaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClose?: () => void;
  pessoa?: any;
  tenantId?: string;
}

export const EditarPessoaModal = ({
  open,
  onOpenChange,
  onClose,
  pessoa
}: EditarPessoaModalProps) => {
  const {
    mutate: atualizarPessoa,
    isPending
  } = useAtualizarPessoaComplete();
  const {
    pipelines: allPipelines,
    isLoading: isLoadingPipelines
  } = usePipelines();
  const { data: teams = [], isLoading: isLoadingTeams } = useTeams();
  const { data: companies = [], isLoading: isLoadingCompanies } = useCompanies();
  const { data: peopleCompanies = [] } = usePeopleCompanies(pessoa?.id);
  const updatePeopleCompanies = useUpdatePeopleCompanies();
  
  const pipelines = allPipelines.filter(p => p.active || p.ativo);

  const { data: pessoaCompleta, isLoading: isLoadingPessoa } = useQuery({
    queryKey: ['pessoa-completa', pessoa?.id],
    queryFn: async () => {
      if (!pessoa?.id) return null;
      
      const { data, error } = await supabase
        .from('clients_people')
        .select(`
          *,
          leads(
            id,
            teams_id,
            leads_pipelines_id
          ),
          score_matrix:score_matrix_id(
            id,
            objective_id,
            investment_id,
            framing_id,
            score_number
          )
        `)
        .eq('id', pessoa.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: open && !!pessoa?.id,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
  
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    whatsapp: '',
    documento: '',
    instagram_handle: '',
    status: 'active',
    observacoes: '',
    aceita_ligacao: true,
    tipo: 'lead',
    pipeline_id: '',
    team_id: '',
    score_objective_id: '',
    score_investment_id: '',
    score_framing_id: '',
    score_matrix_id: null as string | null
  });

  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [companiesPopoverOpen, setCompaniesPopoverOpen] = useState(false);
  const [isLoadingScore, setIsLoadingScore] = useState(false);

  useEffect(() => {
    if (!open) {
      setFormData({
        nome: '',
        email: '',
        whatsapp: '',
        documento: '',
        instagram_handle: '',
        status: 'active',
        observacoes: '',
        aceita_ligacao: true,
        tipo: 'lead',
        pipeline_id: '',
        team_id: '',
        score_objective_id: '',
        score_investment_id: '',
        score_framing_id: '',
        score_matrix_id: null
      });
      setSelectedCompanyIds([]);
      setIsLoadingScore(false);
    }
  }, [open, pessoa]);

  useEffect(() => {
    if (!pessoaCompleta) return;
    
    setFormData({
      nome: pessoaCompleta.name || '',
      email: pessoaCompleta.email || '',
      whatsapp: pessoaCompleta.whatsapp || '',
      documento: pessoaCompleta.document || '',
      instagram_handle: pessoaCompleta.instagram_handle || '',
      status: pessoaCompleta.status || 'active',
      observacoes: pessoaCompleta.notes || '',
      aceita_ligacao: pessoaCompleta.accepts_calls ?? true,
      tipo: pessoaCompleta.type || 'lead',
      pipeline_id: pessoaCompleta.leads?.[0]?.leads_pipelines_id || '',
      team_id: pessoaCompleta.leads?.[0]?.teams_id || '',
      // Usa os campos individuais diretamente da pessoa (não da matriz)
      score_objective_id: pessoaCompleta.score_objective_id || '',
      score_investment_id: pessoaCompleta.score_investment_id || '',
      score_framing_id: pessoaCompleta.score_framing_id || '',
      score_matrix_id: pessoaCompleta.score_matrix_id || null
    });
  }, [pessoaCompleta]);

  // Load existing company relationships
  useEffect(() => {
    if (peopleCompanies.length > 0) {
      setSelectedCompanyIds(peopleCompanies.map(pc => pc.company_id));
    }
  }, [peopleCompanies]);

  const handleClose = () => {
    onOpenChange(false);
    onClose?.();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim() || !pessoa?.id) {
      return;
    }

    atualizarPessoa({
      id: pessoa.id,
      nome: formData.nome,
      email: formData.email || undefined,
      whatsapp: formData.whatsapp || undefined,
      documento: formData.documento || undefined,
      instagram_handle: formData.instagram_handle || undefined,
      status: formData.status,
      observacoes: formData.observacoes || undefined,
      aceita_ligacao: formData.aceita_ligacao,
      tipo: formData.tipo || undefined,
      team_id: formData.team_id || undefined,
      // Campos individuais de score - o trigger no banco faz a vinculação automática da matriz
      score_objective_id: formData.score_objective_id || undefined,
      score_investment_id: formData.score_investment_id || undefined,
      score_framing_id: formData.score_framing_id || undefined
    }, {
      onSuccess: (result) => {
        // Update company relationships
        updatePeopleCompanies.mutate({
          peopleId: pessoa.id,
          companyIds: selectedCompanyIds
        });
        // If auto-merge happened, close modal (toast is shown by the hook)
        handleClose();
      }
    });
  };

  const handleCompanySelect = (companyId: string) => {
    setSelectedCompanyIds(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    );
  };

  const handleRemoveCompany = (companyId: string) => {
    setSelectedCompanyIds(prev => prev.filter(id => id !== companyId));
  };

  const selectedCompanies = companies.filter(c => selectedCompanyIds.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Pessoa</DialogTitle>
        </DialogHeader>
        
        {isLoadingPessoa ? (
          <div className="space-y-4 p-6">
            <div className="h-10 bg-muted animate-pulse rounded"></div>
            <div className="h-10 bg-muted animate-pulse rounded"></div>
            <div className="h-10 bg-muted animate-pulse rounded"></div>
            <div className="h-20 bg-muted animate-pulse rounded"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <Card className="border border-border rounded-[2px]">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="nome">Nome *</Label>
                    <Input id="nome" value={formData.nome} onChange={e => setFormData({
                    ...formData,
                    nome: e.target.value
                  })} placeholder="Nome completo" required />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={formData.email} onChange={e => setFormData({
                      ...formData,
                      email: e.target.value
                    })} placeholder="email@exemplo.com" />
                    </div>

                    <WhatsAppInput
                      value={formData.whatsapp}
                      onChange={(_, dbValue) => setFormData({
                        ...formData,
                        whatsapp: dbValue
                      })}
                      label="WhatsApp"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="documento">Documento (CPF/CNPJ)</Label>
                      <Input id="documento" value={formData.documento} onChange={e => setFormData({
                      ...formData,
                      documento: e.target.value
                    })} placeholder="000.000.000-00" />
                    </div>
                    <div>
                      <Label htmlFor="instagram_handle">Instagram</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                        <Input
                          id="instagram_handle"
                          value={formData.instagram_handle}
                          onChange={e => setFormData({ ...formData, instagram_handle: e.target.value.replace(/^@/, '') })}
                          placeholder="usuario"
                          className="pl-7"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Companies Multi-Select */}
                  <div>
                    <Label>Empresas</Label>
                    <Popover open={companiesPopoverOpen} onOpenChange={setCompaniesPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={companiesPopoverOpen}
                          className="w-full justify-between"
                          disabled={isLoadingCompanies}
                        >
                          <span className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {selectedCompanyIds.length === 0 
                              ? "Selecionar empresas..." 
                              : `${selectedCompanyIds.length} selecionada(s)`}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar empresa..." />
                          <CommandList>
                            <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                            <CommandGroup>
                              {companies.map((company) => (
                                <CommandItem
                                  key={company.id}
                                  value={company.trade_name}
                                  onSelect={() => handleCompanySelect(company.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedCompanyIds.includes(company.id) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div>
                                    <p className="font-medium">{company.trade_name}</p>
                                    {company.legal_name && (
                                      <p className="text-xs text-muted-foreground">{company.legal_name}</p>
                                    )}
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    
                    {selectedCompanies.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedCompanies.map(company => (
                          <Badge key={company.id} variant="secondary" className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {company.trade_name}
                            <button
                              type="button"
                              onClick={() => handleRemoveCompany(company.id)}
                              className="ml-1 hover:bg-muted rounded-full"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Pipeline e Time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="pipeline">Pipeline</Label>
                      <Select value={formData.pipeline_id} onValueChange={value => setFormData({
                      ...formData,
                      pipeline_id: value
                    })} disabled={true}>
                        <SelectTrigger id="pipeline">
                          <SelectValue placeholder="Pipeline (não editável)" />
                        </SelectTrigger>
                        <SelectContent>
                          {pipelines?.map(pipeline => <SelectItem key={pipeline.id} value={pipeline.id}>
                              {pipeline.name}
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="team">Time de Atendimento</Label>
                      <Select value={formData.team_id} onValueChange={value => setFormData({
                      ...formData,
                      team_id: value
                    })} disabled={isLoadingTeams}>
                        <SelectTrigger id="team">
                          <SelectValue placeholder={isLoadingTeams ? "Carregando..." : "Selecione o time"} />
                        </SelectTrigger>
                        <SelectContent>
                          {teams.map(team => <SelectItem key={team.id} value={team.id}>
                              {team.nome}
                            </SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="observacoes">Observações</Label>
                    <RichTextEditor
                      content={formData.observacoes}
                      onChange={(html) => setFormData(prev => ({ ...prev, observacoes: html }))}
                      placeholder="Observações adicionais"
                      minHeight="120px"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Score Section */}
            <div className="mt-6">
              <PersonScoreSection
                objectiveId={formData.score_objective_id}
                investmentId={formData.score_investment_id}
                framingId={formData.score_framing_id}
                onObjectiveChange={(value) => setFormData({ ...formData, score_objective_id: value })}
                onInvestmentChange={(value) => setFormData({ ...formData, score_investment_id: value })}
                onFramingChange={(value) => setFormData({ ...formData, score_framing_id: value })}
                onScoreMatrixIdChange={(id) => setFormData({ ...formData, score_matrix_id: id })}
                onLoadingChange={setIsLoadingScore}
              />
            </div>

            <Card className="border border-border rounded-[2px] mt-6">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 pt-8">
                      <Switch id="aceita_ligacao" checked={formData.aceita_ligacao} onCheckedChange={checked => setFormData({
                      ...formData,
                      aceita_ligacao: checked
                    })} />
                      <Label htmlFor="aceita_ligacao" className="cursor-pointer">
                        Aceita ligação
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isPending || !formData.nome.trim() || isLoadingScore}>
                    {isPending ? 'Salvando...' : isLoadingScore ? 'Buscando score...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EditarPessoaModal;