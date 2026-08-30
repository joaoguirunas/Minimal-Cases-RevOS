import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCriarNegocio } from "@/hooks/useNegocios";
import { usePessoas as usePessoasReal } from "@/hooks/usePessoasReal";
import { useCriarPessoa } from "@/hooks/useCriarPessoa";
import { usePipelines } from "@/hooks/usePipelines";
import { useCompanies, useCreateCompany } from "@/hooks/useCompanies";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Building2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface NovoNegocioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageId?: string | null;
}

const countryOptions = [
  { code: "+55", country: "Brasil", flag: "🇧🇷" },
  { code: "+1", country: "Estados Unidos", flag: "🇺🇸" },
  { code: "+54", country: "Argentina", flag: "🇦🇷" },
  { code: "+56", country: "Chile", flag: "🇨🇱" },
  { code: "+57", country: "Colômbia", flag: "🇨🇴" },
  { code: "+51", country: "Peru", flag: "🇵🇪" },
  { code: "+598", country: "Uruguai", flag: "🇺🇾" },
  { code: "+595", country: "Paraguai", flag: "🇵🇾" },
];

const NovoNegocioModal = ({ open, onOpenChange, stageId }: NovoNegocioModalProps) => {
  const [activeTab, setActiveTab] = useState("escolher-cliente");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [openClienteCombobox, setOpenClienteCombobox] = useState(false);
  
  // Empresa
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [openEmpresaCombobox, setOpenEmpresaCombobox] = useState(false);
  const [showNovaEmpresa, setShowNovaEmpresa] = useState(false);
  const [novaEmpresaNome, setNovaEmpresaNome] = useState("");
  
  // Formulário para nova pessoa
  const [novoClienteData, setNovoClienteData] = useState({
    nome: "",
    email: "",
    whatsappCountry: "+55",
    whatsappNumber: "",
    observacoes: "",
    aceita_ligacao: true
  });

  // Dados do negócio
  const [negocioData, setNegocioData] = useState({
    pipeline_id: "",
    titulo: "",
    valor: ""
  });

  const criarNegocio = useCriarNegocio();
  const criarPessoa = useCriarPessoa();
  const criarEmpresa = useCreateCompany();
  const { data: pessoas = [] } = usePessoasReal();
  const { data: empresas = [] } = useCompanies();
  const { pipelines: allPipelines = [], stages = [] } = usePipelines();
  
  // Filter only active pipelines for selection
  const pipelines = allPipelines.filter(p => p.active || p.ativo);

  // Set pipeline based on stageId when modal opens
  useEffect(() => {
    if (stageId && stages.length > 0) {
      const stage = stages.find(s => s.id === stageId);
      if (stage) {
        setNegocioData(prev => ({ ...prev, pipeline_id: stage.pipeline_id }));
      }
    }
  }, [stageId, stages]);

  const handleSubmit = async () => {
    try {
      let personId = selectedPersonId;
      let companyId = selectedCompanyId;

      // Validar ANTES de criar a empresa: criar a empresa primeiro e só depois falhar
      // a validação (ex: "Nome é obrigatório") deixava a empresa órfã, sem nenhum
      // lead/pessoa vinculado — e se o usuário corrigisse o campo e reenviasse, o
      // texto do nome da empresa continuava preenchido e ela era criada de novo.
      if (activeTab === "criar-cliente") {
        if (!novoClienteData.nome.trim()) {
          toast.error("Nome é obrigatório");
          return;
        }
        if (!negocioData.pipeline_id) {
          toast.error("Selecione um pipeline");
          return;
        }
      } else {
        if (!personId) {
          toast.error("Selecione um cliente");
          return;
        }
        if (!negocioData.pipeline_id) {
          toast.error("Selecione um pipeline");
          return;
        }
      }

      // Criar nova empresa se necessário
      if (showNovaEmpresa && novaEmpresaNome.trim()) {
        const novaEmpresa = await criarEmpresa.mutateAsync({ trade_name: novaEmpresaNome });
        companyId = novaEmpresa.id;
      }

      // Se está criando novo cliente
      if (activeTab === "criar-cliente") {
        const whatsapp = novoClienteData.whatsappNumber ?
          `${novoClienteData.whatsappCountry}${novoClienteData.whatsappNumber}` :
          undefined;

        const dadosPessoa = {
          nome: novoClienteData.nome.trim(),
          email: novoClienteData.email.trim() || undefined,
          whatsapp,
          status: "active",
          observacoes: novoClienteData.observacoes.trim() || undefined,
          aceita_ligacao: novoClienteData.aceita_ligacao,
          pipeline_id: negocioData.pipeline_id,
          company_id: companyId || undefined,
        };

        console.log('Criando pessoa com dados:', dadosPessoa);
        const resultado = await criarPessoa.mutateAsync(dadosPessoa);
        personId = resultado.pessoa.id;
      } else {
        // Use the passed stageId or find the first stage of the selected pipeline
        let targetStageId = stageId;
        if (!targetStageId) {
          const pipelineStages = stages.filter(stage => stage.pipeline_id === negocioData.pipeline_id);
          targetStageId = pipelineStages.sort((a, b) => a.ordem - b.ordem)[0]?.id || "";
        }

        const dadosNegocio = {
          person_id: personId,
          pipeline_id: negocioData.pipeline_id,
          stage_id: targetStageId,
          company_id: companyId || undefined,
          titulo: negocioData.titulo.trim() || undefined,
          valor: negocioData.valor ? parseFloat(negocioData.valor) : undefined,
        };

        console.log('Criando lead com dados:', dadosNegocio);
        await criarNegocio.mutateAsync(dadosNegocio);
      }

      handleClose();
    } catch (error) {
      console.error("Erro ao criar lead:", error);
      toast.error("Erro ao criar lead. Tente novamente.");
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setActiveTab("escolher-cliente");
    setSelectedPersonId("");
    setSelectedCompanyId("");
    setOpenClienteCombobox(false);
    setOpenEmpresaCombobox(false);
    setShowNovaEmpresa(false);
    setNovaEmpresaNome("");
    setNovoClienteData({
      nome: "",
      email: "",
      whatsappCountry: "+55",
      whatsappNumber: "",
      observacoes: "",
      aceita_ligacao: true
    });
    setNegocioData({
      pipeline_id: "",
      titulo: "",
      valor: ""
    });
  };

  const isLoading = criarNegocio.isPending || criarPessoa.isPending || criarEmpresa.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">Novo Lead</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Escolha um cliente existente ou crie um novo cliente para o lead.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-transparent p-0 rounded-none border-b border-border h-[45px]">
            <TabsTrigger
              value="escolher-cliente"
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[13px]"
            >
              Escolher Cliente
            </TabsTrigger>
            <TabsTrigger
              value="criar-cliente"
              className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-[13px]"
            >
              Novo Cliente
            </TabsTrigger>
          </TabsList>

          <TabsContent value="escolher-cliente" className="space-y-4 mt-6">
            <div>
              <Label htmlFor="cliente" className="text-sm font-medium text-foreground">Cliente *</Label>
              <Popover open={openClienteCombobox} onOpenChange={setOpenClienteCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openClienteCombobox}
                    className="w-full justify-between border-border h-[30px] mt-2 rounded-[4px]"
                    disabled={isLoading}
                  >
                    {selectedPersonId
                      ? pessoas.find((pessoa) => pessoa.id === selectedPersonId)?.nome
                      : "Buscar cliente..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 rounded-[4px]">
                  <Command>
                    <CommandInput placeholder="Digite o nome do cliente..." className="h-9" />
                    <CommandList>
                      <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                      <CommandGroup>
                        {pessoas.map((pessoa) => (
                          <CommandItem
                            key={pessoa.id}
                            value={pessoa.nome}
                            onSelect={() => {
                              setSelectedPersonId(pessoa.id);
                              setOpenClienteCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedPersonId === pessoa.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="text-foreground">{pessoa.nome}</span>
                              {pessoa.whatsapp && (
                                <span className="text-xs text-muted-foreground">{pessoa.whatsapp}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </TabsContent>

          <TabsContent value="criar-cliente" className="space-y-4 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="nome" className="text-sm font-medium text-foreground">Nome *</Label>
                <Input
                  id="nome"
                  value={novoClienteData.nome}
                  onChange={(e) => setNovoClienteData(prev => ({ ...prev, nome: e.target.value }))}
                  placeholder="Nome completo"
                  disabled={isLoading}
                  className="border-border h-[30px] mt-2 rounded-[4px]"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-sm font-medium text-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={novoClienteData.email}
                  onChange={(e) => setNovoClienteData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                  disabled={isLoading}
                  className="border-border h-[30px] mt-2 rounded-[4px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="whatsapp" className="text-sm font-medium text-foreground">WhatsApp</Label>
              <div className="flex gap-2 mt-2">
                <Select 
                  value={novoClienteData.whatsappCountry} 
                  onValueChange={(value) => setNovoClienteData(prev => ({ ...prev, whatsappCountry: value }))}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-32 border-border h-[30px] rounded-[4px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.flag} {country.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={novoClienteData.whatsappNumber}
                  onChange={(e) => setNovoClienteData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                  placeholder="11999990000"
                  disabled={isLoading}
                  className="flex-1 border-border h-[30px] rounded-[4px]"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="aceita_ligacao"
                checked={novoClienteData.aceita_ligacao}
                onCheckedChange={(checked) => setNovoClienteData(prev => ({ ...prev, aceita_ligacao: checked }))}
                disabled={isLoading}
              />
              <Label htmlFor="aceita_ligacao" className="text-sm font-medium text-foreground">Aceita ligações</Label>
            </div>

            <div>
              <Label htmlFor="observacoes" className="text-sm font-medium text-foreground">Observações</Label>
              <div className="mt-2">
                <RichTextEditor
                  content={novoClienteData.observacoes}
                  onChange={(html) => setNovoClienteData(prev => ({ ...prev, observacoes: html }))}
                  placeholder="Observações sobre o cliente..."
                  minHeight="100px"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-4 border-t border-border pt-6">
          <h3 className="text-base font-semibold text-foreground">Detalhes do Lead</h3>
          
          {/* Empresa */}
          <div>
            <Label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Empresa (opcional)
            </Label>
            {!showNovaEmpresa ? (
              <div className="flex gap-2 mt-2">
                <Popover open={openEmpresaCombobox} onOpenChange={setOpenEmpresaCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openEmpresaCombobox}
                      className="flex-1 justify-between border-border h-[30px] rounded-[4px]"
                      disabled={isLoading}
                    >
                      {selectedCompanyId
                        ? empresas.find((e) => e.id === selectedCompanyId)?.trade_name
                        : "Selecionar empresa..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0 rounded-[4px]">
                    <Command>
                      <CommandInput placeholder="Buscar empresa..." className="h-9" />
                      <CommandList>
                        <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                        <CommandGroup>
                          {empresas.map((empresa) => (
                            <CommandItem
                              key={empresa.id}
                              value={empresa.trade_name}
                              onSelect={() => {
                                setSelectedCompanyId(empresa.id);
                                setOpenEmpresaCombobox(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCompanyId === empresa.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="text-foreground">{empresa.trade_name}</span>
                                {empresa.legal_name && (
                                  <span className="text-xs text-muted-foreground">{empresa.legal_name}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNovaEmpresa(true)}
                  className="h-[30px] w-[30px] rounded-[4px]"
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 mt-2">
                <Input
                  value={novaEmpresaNome}
                  onChange={(e) => setNovaEmpresaNome(e.target.value)}
                  placeholder="Nome da nova empresa"
                  disabled={isLoading}
                  className="flex-1 border-border h-[30px] rounded-[4px]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNovaEmpresa(false);
                    setNovaEmpresaNome("");
                  }}
                  className="h-[30px] rounded-[4px] text-xs"
                >
                  Cancelar
                </Button>
              </div>
            )}
          </div>
          
          <div>
            <Label htmlFor="titulo" className="text-sm font-medium text-foreground">Título do Lead</Label>
            <Input
              id="titulo"
              value={negocioData.titulo}
              onChange={(e) => setNegocioData(prev => ({ ...prev, titulo: e.target.value }))}
              placeholder="Digite um título para o lead (opcional)"
              disabled={isLoading}
              className="border-border h-[30px] mt-2 rounded-[4px]"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pipeline_id" className="text-sm font-medium text-foreground">Pipeline *</Label>
              <Select
                value={negocioData.pipeline_id}
                onValueChange={(value) => setNegocioData(prev => ({ ...prev, pipeline_id: value }))}
                disabled={isLoading}
              >
                <SelectTrigger className="border-border h-[30px] mt-2 rounded-[4px]">
                  <SelectValue placeholder="Selecione o pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id}>
                      {pipeline.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="valor" className="text-sm font-medium text-foreground">Valor do Lead</Label>
              <Input
                id="valor"
                type="number"
                value={negocioData.valor}
                onChange={(e) => setNegocioData(prev => ({ ...prev, valor: e.target.value }))}
                placeholder="0.00"
                disabled={isLoading}
                className="border-border h-[30px] mt-2 rounded-[4px]"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose} 
            disabled={isLoading}
            className="rounded-[4px]"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-[4px]"
          >
            {isLoading ? "Criando..." : "Criar Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NovoNegocioModal;
