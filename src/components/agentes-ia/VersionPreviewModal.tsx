import { Eye, Calendar, Hash } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangelogDisplay } from './ChangelogDisplay';
import { useHistoricoAgente } from '@/hooks/useAgentesIA';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VersionPreviewModalProps {
  agentId: string;
  version: number;
  open: boolean;
  onClose: () => void;
}

export const VersionPreviewModal = ({
  agentId,
  version,
  open,
  onClose
}: VersionPreviewModalProps) => {
  const { data: historico } = useHistoricoAgente(agentId);

  const versionData = historico?.find(h => h.versao === version);

  if (!versionData) {
    return null;
  }

  const formatDate = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: ptBR
      });
    } catch {
      return 'Data inválida';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4" />
            Preview da Versão {version}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4 text-xs mt-1">
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(versionData.created_at)}
            </div>
            <div className="flex items-center gap-1">
              <Hash className="h-3 w-3" />
              Versão {version}
            </div>
            <Badge variant={versionData.usa_etapas ? "default" : "secondary"} className="text-[10px] h-4">
              {versionData.usa_etapas ? "Multi-etapas" : "Único"}
            </Badge>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="changelog" className="flex flex-col flex-1 min-h-0">
          <div className="px-6 border-b border-border shrink-0">
            <TabsList className="h-9 bg-transparent p-0 gap-0 rounded-none">
              {(['changelog', 'config', 'prompts', 'etapas'] as const).map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="h-9 rounded-none text-xs px-4 border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none text-muted-foreground"
                >
                  {tab === 'changelog' ? 'Alterações' : tab === 'config' ? 'Configuração' : tab === 'prompts' ? 'Prompts' : 'Etapas'}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="flex-1 min-h-0 relative">
            <TabsContent value="changelog" className="mt-0 absolute inset-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-4">
                  {versionData.changelog ? (
                    <ChangelogDisplay
                      changelog={typeof versionData.changelog === 'string' ? versionData.changelog : JSON.stringify(versionData.changelog)}
                      compact={false}
                    />
                  ) : (
                    <Card>
                      <CardContent className="p-4 text-center text-muted-foreground text-sm">
                        Nenhum changelog detalhado disponível para esta versão
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="config" className="mt-0 absolute inset-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Tipo de Agente</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge variant={versionData.usa_etapas ? "default" : "secondary"}>
                          {versionData.usa_etapas ? "Multi-etapas" : "Único"}
                        </Badge>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Campos Preenchidos</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="text-xs space-y-1">
                          {[
                            { label: 'Dados de entrada', value: versionData.dados_entrada },
                            { label: 'Identidade', value: versionData.identidade },
                            { label: 'Regras gerais', value: versionData.regras_gerais },
                            { label: 'Prompt base', value: versionData.prompt_base },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex justify-between">
                              <span>{label}:</span>
                              <Badge variant={value ? "default" : "secondary"} className="text-xs h-4">
                                {value ? 'Sim' : 'Não'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="prompts" className="mt-0 absolute inset-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-4">
                  {versionData.dados_entrada && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Dados de Entrada</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs bg-muted p-3 rounded-[2px] font-mono whitespace-pre-wrap">
                          {versionData.dados_entrada}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {versionData.identidade && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Identidade</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs bg-muted p-3 rounded-[2px] font-mono whitespace-pre-wrap">
                          {versionData.identidade}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {versionData.regras_gerais && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Regras Gerais</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs bg-muted p-3 rounded-[2px] font-mono whitespace-pre-wrap">
                          {versionData.regras_gerais}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {versionData.prompt_base && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Prompt Base</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-xs bg-muted p-3 rounded-[2px] font-mono whitespace-pre-wrap">
                          {versionData.prompt_base}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!versionData.dados_entrada && !versionData.identidade && !versionData.regras_gerais && !versionData.prompt_base && (
                    <Card>
                      <CardContent className="p-4 text-center text-muted-foreground text-sm">
                        Nenhum prompt disponível para esta versão
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="etapas" className="mt-0 absolute inset-0">
              <ScrollArea className="h-full">
                <div className="p-6 space-y-4">
                  {versionData.steps && versionData.steps.length > 0 ? (
                    <div className="space-y-3">
                      {versionData.steps.map((step, i) => (
                        <Card key={step.id ?? i}>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[2px] bg-muted border border-border text-muted-foreground">
                                controle: {step.controle}
                              </span>
                              {step.nome || `Etapa ${i + 1}`}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-xs bg-muted p-3 rounded-[2px] font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {step.prompt || '(sem prompt)'}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : !versionData.usa_etapas ? (
                    <Card>
                      <CardContent className="p-4 text-center text-muted-foreground text-sm">
                        Esta versão usa prompt único (não possui etapas)
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="p-4 text-center text-muted-foreground text-sm">
                        Etapas não disponíveis para esta versão
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end px-6 py-3 border-t border-border shrink-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
