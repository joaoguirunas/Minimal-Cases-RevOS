import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NovoTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (templateId: string) => void;
}

export const NovoTemplateModal = ({
  open,
  onClose,
  onSuccess,
}: NovoTemplateModalProps) => {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [templateType, setTemplateType] = useState('');
  const [identidade, setIdentidade] = useState('');
  const [inputData, setInputData] = useState('');
  const [regrasGerais, setRegrasGerais] = useState('');
  const [loading, setLoading] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const templateTypes = [
    { value: 'triagem', label: 'Triagem (Recepção)' },
    { value: 'qualificacao', label: 'Qualificação (4 etapas)' },
    { value: 'agendamento', label: 'Agendamento (3 etapas)' },
    { value: 'custom', label: 'Personalizado' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim() || !templateType) {
      toast({
        title: 'Erro',
        description: 'Preencha o nome e tipo do template',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('ai_agents')
        .insert({
          name: `Template — ${nome.trim()}`,
          description: descricao.trim() || null,
          identity: identidade.trim() || null,
          input_data: inputData.trim() || null,
          general_rules: regrasGerais.trim() || null,
          is_template: true,
          template_type: templateType,
          active: true,
          use_stages: false,
          current_version: 1,
        })
        .select()
        .single();

      if (error) throw error;

      // Reset form
      setNome('');
      setDescricao('');
      setTemplateType('');
      setIdentidade('');
      setInputData('');
      setRegrasGerais('');

      // Invalidate templates cache
      queryClient.invalidateQueries({ queryKey: ['ai-agents-templates'] });

      toast({
        title: 'Sucesso',
        description: 'Template criado com sucesso',
      });

      onSuccess(data.id);
    } catch (error) {
      console.error('Erro ao criar template:', error);
      toast({
        title: 'Erro',
        description:
          error instanceof Error ? error.message : 'Erro ao criar template',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setNome('');
    setDescricao('');
    setTemplateType('');
    setIdentidade('');
    setInputData('');
    setRegrasGerais('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Novo Modelo de Agente
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Template *</Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Triagem VIP"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateType">Tipo de Template *</Label>
              <Select value={templateType} onValueChange={setTemplateType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {templateTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o propósito deste template..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="identidade">Identidade do Agente</Label>
            <Textarea
              id="identidade"
              value={identidade}
              onChange={(e) => setIdentidade(e.target.value)}
              placeholder="Ex: Você é Sofia, assistente de triagem da empresa..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inputData">Dados de Entrada</Label>
            <Textarea
              id="inputData"
              value={inputData}
              onChange={(e) => setInputData(e.target.value)}
              placeholder="Ex: - {{lead_id}} — ID do negócio&#10;- {{nome}} — Nome do contato..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="regrasGerais">Regras Gerais</Label>
            <Textarea
              id="regrasGerais"
              value={regrasGerais}
              onChange={(e) => setRegrasGerais(e.target.value)}
              placeholder="Ex: 1. Apresente-se pelo nome na primeira mensagem&#10;2. Colete: nome, empresa e intenção..."
              rows={4}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!nome.trim() || !templateType || loading}>
              {loading ? 'Criando...' : 'Criar Template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
