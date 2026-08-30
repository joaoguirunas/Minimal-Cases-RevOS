import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, TrendingUp, Layers, Webhook, Eye } from 'lucide-react';
import { WhatsappTemplatePreview } from '@/components/config/WhatsappTemplatePreview';
import { useState } from 'react';

interface ConfigurationSectionProps {
  template?: {
    nome: string;
    id_template?: string;
    json_data?: any;
  };
  pipeline?: {
    name: string;
  };
  stage?: {
    name: string;
    color?: string;
  };
  webhook?: {
    name?: string;
    webhook_url: string;
  };
  delay?: number;
}

export function ConfigurationSection({ 
  template, 
  pipeline, 
  stage, 
  webhook,
  delay = 0 
}: ConfigurationSectionProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="p-6 border border-border bg-card rounded-[2px]">
        <h3 className="text-[18px] font-['Outfit'] font-semibold mb-6">Configurações do Disparo</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* WhatsApp Template */}
          {template && (
            <div className="space-y-3 p-4 rounded-[2px] border border-white/[0.06] bg-card hover:bg-white/[0.035] transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-[4px] bg-green-500/10">
                    <MessageSquare className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Template WhatsApp</p>
                    <p className="font-semibold text-foreground">{template.nome}</p>
                    {template.id_template && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        ID: {template.id_template}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  className="h-[30px] rounded-[4px] text-xs gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Ver
                </Button>
              </div>

              {/* Inline Preview */}
              {showPreview && template.json_data && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-3 border-t border-border"
                >
                  <div className="p-3 bg-background rounded-[2px] border border-border">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Prévia da Mensagem:</p>
                    <div className="text-sm whitespace-pre-wrap text-foreground">
                      {template.json_data.data || template.json_data.containerMeta ? 
                        (template.json_data.data || JSON.parse(template.json_data.containerMeta || '{}').data || 'Template sem conteúdo') 
                        : 'Formato de template inválido'}
                    </div>
                    {template.json_data.containerMeta && (() => {
                      try {
                        const meta = JSON.parse(template.json_data.containerMeta);
                        if (meta.buttons && meta.buttons.length > 0) {
                          return (
                            <div className="mt-3 pt-3 border-t space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">Botões:</p>
                              {meta.buttons.map((btn: any, idx: number) => (
                                <div key={idx} className="px-3 py-2 bg-muted rounded text-xs text-center">
                                  {btn.text}
                                </div>
                              ))}
                            </div>
                          );
                        }
                      } catch (e) {
                        return null;
                      }
                    })()}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Pipeline */}
          {pipeline && (
            <div className="space-y-2 p-4 rounded-[2px] border border-white/[0.06] bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[4px] bg-purple-500/10">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pipeline</p>
                  <p className="font-semibold text-foreground">{pipeline.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Stage */}
          {stage && (
            <div className="space-y-2 p-4 rounded-[2px] border border-white/[0.06] bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[4px] bg-blue-500/10">
                  <Layers className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Etapa</p>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground">{stage.name}</p>
                    {stage.color && (
                      <div
                        className="w-3 h-3 rounded-full border"
                        style={{ backgroundColor: stage.color }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Webhook */}
          {webhook && (
            <div className="space-y-2 p-4 rounded-[2px] border border-white/[0.06] bg-card">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-[4px] bg-orange-500/10">
                  <Webhook className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Webhook</p>
                  <p className="font-semibold text-foreground">{webhook.name || 'N8N'}</p>
                  <p className="text-xs text-muted-foreground truncate mt-1">{webhook.webhook_url}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
