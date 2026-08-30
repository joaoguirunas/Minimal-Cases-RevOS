import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WhatsappTemplatePreview } from '@/components/config/WhatsappTemplatePreview';
import { MessageSquare } from 'lucide-react';

interface TemplatePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: {
    nome: string;
    id_template?: string;
    json_data?: {
      components: any[];
    };
  } | null;
}

export function TemplatePreviewModal({ open, onOpenChange, template }: TemplatePreviewModalProps) {
  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Pré-visualização do Template
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Nome do Template:</span>
              <p className="text-base font-semibold">{template.nome}</p>
            </div>
            {template.id_template && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">ID do Template:</span>
                <p className="text-sm font-mono bg-muted px-2 py-1 rounded-[2px] inline-block ml-2">
                  {template.id_template}
                </p>
              </div>
            )}
          </div>

          {template.json_data?.components && Array.isArray(template.json_data.components) ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Mensagem que será enviada:</h3>
              <WhatsappTemplatePreview components={template.json_data.components} />
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Preview do template não disponível</p>
              <p className="text-xs mt-2">Estrutura do template inválida ou incompleta</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
