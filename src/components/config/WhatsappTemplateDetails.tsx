import React from 'react';
import { Badge } from '@/components/ui/badge';
import { WhatsappTemplatePreview } from './WhatsappTemplatePreview';
import { WhatsappTemplate } from '@/hooks/useWhatsappTemplates';

interface WhatsappTemplateDetailsProps {
  template: WhatsappTemplate;
  showLabel?: boolean;
}

export const WhatsappTemplateDetails: React.FC<WhatsappTemplateDetailsProps> = ({
  template,
  showLabel = true
}) => {
  // Convert Meta native components[] format to preview format
  const convertMetaNativeToComponents = () => {
    const comps = template.json_data?.components;
    if (!comps || !Array.isArray(comps)) return [];

    const result: Array<{ type: string; text?: string; buttons?: Array<{ text: string; type: string }> }> = [];

    for (const c of comps) {
      const type = (c.type as string)?.toUpperCase();

      if (type === 'HEADER' && c.text) {
        result.push({ type: 'HEADER', text: c.text as string });
      } else if (type === 'BODY' && c.text) {
        result.push({ type: 'BODY', text: c.text as string });
      } else if (type === 'FOOTER' && c.text) {
        result.push({ type: 'FOOTER', text: c.text as string });
      } else if (type === 'BUTTONS' && Array.isArray(c.buttons)) {
        result.push({
          type: 'BUTTONS',
          buttons: (c.buttons as Array<Record<string, unknown>>).map(b => ({
            text: (b.text as string) ?? '',
            type: (b.type as string) ?? 'QUICK_REPLY',
          })),
        });
      }
    }

    return result;
  };

  // Fallback: convert legacy Gupshup format (containerMeta) to preview format
  const convertGupshupToComponents = () => {
    if (!template.json_data) return [];

    const components: Array<{ type: string; text?: string; buttons?: Array<{ text: string; type: string }> }> = [];

    // Parse containerMeta if it exists
    let containerMeta: any = {};
    try {
      if (template.json_data.containerMeta) {
        containerMeta = JSON.parse(template.json_data.containerMeta);
      }
    } catch (e) {
      console.error('Erro ao parsear containerMeta:', e);
    }

    if (containerMeta.header) {
      components.push({ type: 'HEADER', text: containerMeta.header });
    }

    const bodyText = containerMeta.data || template.json_data.data;
    if (bodyText) {
      components.push({ type: 'BODY', text: bodyText });
    }

    if (containerMeta.footer) {
      components.push({ type: 'FOOTER', text: containerMeta.footer });
    }

    if (containerMeta.buttons && Array.isArray(containerMeta.buttons)) {
      components.push({ type: 'BUTTONS', buttons: containerMeta.buttons });
    }

    return components;
  };

  // Detect format: Meta native (components array) vs Gupshup legacy (containerMeta string)
  const isMetaNative = Array.isArray(template.json_data?.components);
  const previewComponents = isMetaNative
    ? convertMetaNativeToComponents()
    : convertGupshupToComponents();

  if (previewComponents.length === 0) {
    return (
      <div className="rounded-[4px] border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-[12px] font-medium text-muted-foreground">Pré-visualização indisponível</p>
        <p className="text-[11px] text-muted-foreground/60">
          Este template não possui componentes de texto legíveis. Verifique a configuração no painel da operadora.
        </p>
        {template.id_template && (
          <p className="text-[11px] font-mono text-muted-foreground/50">ID: {template.id_template}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {showLabel && (
        <label className="text-sm font-medium text-muted-foreground mb-3 block">
          Preview da Mensagem
        </label>
      )}

      {/* Variáveis disponíveis */}
      {template.variables && Array.isArray(template.variables) && template.variables.length > 0 && (
        <div className="mb-4 p-3 bg-muted rounded-[2px] border border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Variáveis disponíveis:</p>
          <div className="space-y-1.5">
            {template.variables.map((variable: any, index: number) => (
              <div key={index} className="flex items-start gap-2 text-xs">
                <Badge variant="outline" className="rounded-[4px] px-1.5 py-0.5 h-5 font-mono text-[10px]">
                  {`{{${variable.placeholder || variable.position}}}`}
                </Badge>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{variable.campo}</span>
                  {variable.exemplo && (
                    <span className="text-muted-foreground ml-1">
                      (ex: {variable.exemplo})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <WhatsappTemplatePreview components={previewComponents} />
    </div>
  );
};
