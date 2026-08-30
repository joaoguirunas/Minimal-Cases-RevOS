import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { FileUp, Filter } from 'lucide-react';
import CriarComFiltrosTab from './CriarComFiltrosTab';
import ConfiguracaoDisparoTab from './ConfiguracaoDisparoTab';
import ChannelSelector from './ChannelSelector';
import { useCriarSend } from '@/hooks/useSendMutations';
import { SendType, SendChannelUi } from '@/types/sends';

interface CriarDisparoModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CriarDisparoModal({ open, onClose }: CriarDisparoModalProps) {
  const navigate = useNavigate();
  const [currentTab, setCurrentTab] = useState('tipo');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<SendType | null>(null);
  const [channel, setChannel] = useState<SendChannelUi>('whatsapp');
  const [filterResult, setFilterResult] = useState<any>(null);
  const [config, setConfig] = useState<any>({});

  const { mutate: criarSend, isPending: isCreating } = useCriarSend();

  const handleClose = () => {
    setCurrentTab('tipo');
    setNome('');
    setTipo(null);
    setChannel('whatsapp');
    setFilterResult(null);
    setConfig({});
    onClose();
  };

  const handleNext = () => {
    if (currentTab === 'tipo') {
      if (!nome || nome.length < 3) {
        toast.error('Nome do disparo deve ter no mínimo 3 caracteres');
        return;
      }
      if (!tipo) {
        toast.error('Selecione o tipo de disparo');
        return;
      }
      setCurrentTab('dados');
    } else if (currentTab === 'dados') {
      if (tipo === 'filtered' && !filterResult) {
        toast.error('Aplique os filtros antes de continuar');
        return;
      }
      setCurrentTab('config');
    }
  };

  const handleBack = () => {
    if (currentTab === 'config') {
      setCurrentTab('dados');
    } else if (currentTab === 'dados') {
      setCurrentTab('tipo');
    }
  };

  const handleCreate = async () => {
    const isVoice = channel === 'voice_ai';

    if (isVoice) {
      if (!config.voice_agent_id) {
        toast.error('Voice agent é obrigatório');
        return;
      }
    } else if (!config.template_id) {
      toast.error('Template é obrigatório');
      return;
    }

    const dbChannel = isVoice ? 'phone' : channel;

    const sendData: any = {
      name: nome,
      type: tipo,
      channel: dbChannel,
      template_id: isVoice ? null : (config.template_id || null),
      webhook_id: config.webhook_id || null,
      send_interval_seconds: config.send_interval_seconds,
      status: config.agendar ? 'scheduled' : 'draft',
      pipeline_id: config.movePipeline ? config.pipeline_id : null,
      stage_ids: config.movePipeline && config.stage_ids?.[0] ? [config.stage_ids[0]] : null,
    };

    if (config.agendar && config.scheduled_date && config.scheduled_time) {
      sendData.scheduled_at = `${config.scheduled_date}T${config.scheduled_time}:00`;
    }

    if (tipo === 'filtered') {
      sendData.filter_config = {
        ...filterResult,
        contacts: filterResult.contacts || [],
        ...(isVoice ? { voice_agent_id: config.voice_agent_id } : {}),
      };
      sendData.total_contacts = filterResult.total || 0;
    } else if (isVoice) {
      sendData.filter_config = { voice_agent_id: config.voice_agent_id };
    }

    criarSend(sendData, {
      onSuccess: () => {
        toast.success('Disparo criado com sucesso!');
        handleClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Disparo</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label htmlFor="nome">Nome do Disparo *</Label>
            <Input
              id="nome"
              placeholder="Ex: Black Friday 2024"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <Tabs value={currentTab} onValueChange={setCurrentTab}>
            <TabsList className="grid w-full grid-cols-3 h-[45px] bg-card dark:bg-zinc-950 rounded-[2px]">
              <TabsTrigger value="tipo" disabled={currentTab !== 'tipo'}>
                1. Tipo
              </TabsTrigger>
              <TabsTrigger value="dados" disabled={!tipo || currentTab === 'tipo'}>
                2. Dados
              </TabsTrigger>
              <TabsTrigger value="config" disabled={currentTab === 'tipo' || currentTab === 'dados'}>
                3. Configuração
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tipo" className="space-y-4">
              <div className="grid grid-cols-2 gap-4 mt-4">
                <button
                  onClick={() => {
                    handleClose();
                    navigate('/settings', { state: { openSection: 'importacao-exportacao' } });
                  }}
                  className="p-6 border rounded-[2px] transition-all border-border hover:border-white/[0.10]"
                >
                  <FileUp className="w-12 h-12 mx-auto mb-3 text-primary" />
                  <h3 className="font-semibold text-[14px] mb-2">Importar Lista</h3>
                  <p className="text-sm text-muted-foreground">
                    Gerencie importações e exportações de contatos
                  </p>
                </button>

                <button
                  onClick={() => setTipo('filtered')}
                  className={`p-6 border rounded-[2px] transition-all ${
                    tipo === 'filtered'
                      ? 'border-primary bg-[#B8924B]/5'
                      : 'border-border hover:border-white/[0.10]'
                  }`}
                >
                  <Filter className="w-12 h-12 mx-auto mb-3 text-primary" />
                  <h3 className="font-semibold text-[14px] mb-2">Criar com Filtros</h3>
                  <p className="text-sm text-muted-foreground">
                    Use filtros avançados para selecionar leads
                  </p>
                </button>
              </div>
            </TabsContent>

            <TabsContent value="dados">
              <CriarComFiltrosTab onFilterResult={setFilterResult} />
            </TabsContent>

            <TabsContent value="config" className="space-y-6">
              <div>
                <Label className="mb-2 block">Canal *</Label>
                <ChannelSelector value={channel} onChange={setChannel} />
              </div>
              <ConfiguracaoDisparoTab onConfigChange={setConfig} channel={channel} />
            </TabsContent>
          </Tabs>

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentTab === 'tipo'}
              className="h-[30px] rounded-[4px] text-xs"
            >
              Voltar
            </Button>

            {currentTab !== 'config' ? (
              <Button onClick={handleNext} className="h-[30px] rounded-[4px] text-xs">
                Próximo
              </Button>
            ) : (
              <Button onClick={handleCreate} disabled={isCreating} className="h-[30px] rounded-[4px] text-xs">
                {isCreating ? 'Criando...' : 'Criar e Iniciar Disparo'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
