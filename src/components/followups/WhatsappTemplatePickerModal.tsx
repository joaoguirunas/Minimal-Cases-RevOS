import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Check, FileText, Eye, EyeOff } from 'lucide-react';
import { useWhatsappTemplates, WhatsappTemplate } from '@/hooks/useWhatsappTemplates';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WhatsappTemplateDetails } from '@/components/config/WhatsappTemplateDetails';

interface WhatsappTemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (templateId: string, templateName: string, templateUuid: string) => void;
  selectedTemplateId?: string;
}

const WhatsappTemplatePickerModal = ({ 
  isOpen, 
  onClose, 
  onSelect,
  selectedTemplateId 
}: WhatsappTemplatePickerModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const { data: allTemplates, isLoading } = useWhatsappTemplates();
  
  const approvedTemplates = allTemplates?.filter(
    t => t.status?.toLowerCase() === 'approved'
  ) || [];
  
  const filteredTemplates = approvedTemplates.filter(template => 
    template.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.id_template.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (template: WhatsappTemplate) => {
    onSelect(template.id_template, template.nome, template.id);
    onClose();
  };

  const togglePreview = (templateId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Evita selecionar o template ao clicar no ícone
    setExpandedTemplateId(prev => prev === templateId ? null : templateId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-[24px] font-semibold">
            Selecionar Template WhatsApp
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Escolha um template aprovado para enviar no follow-up
          </p>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou ID do template..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Templates List */}
        <ScrollArea className="h-[50vh] -mx-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground px-6">
              Carregando templates...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-8 px-6">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum template encontrado</h3>
              <p className="text-muted-foreground">
                {searchTerm 
                  ? 'Tente buscar com outros termos'
                  : 'Nenhum template aprovado disponível'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-4 px-6">
              {filteredTemplates.map((template) => {
                const isSelected = template.id_template === selectedTemplateId || template.id === selectedTemplateId;
                const isExpanded = expandedTemplateId === template.id;

                return (
                  <Card
                    key={template.id}
                    className={`transition-all duration-200 ${
                      isSelected ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <CardContent className="p-3">
                      <div 
                        className="flex items-start justify-between cursor-pointer"
                        onClick={() => handleSelect(template)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-[16px] font-semibold truncate">
                              {template.nome}
                            </h3>
                            {isSelected && (
                              <Badge className="bg-primary text-primary-foreground">
                                <Check className="w-3 h-3 mr-1" />
                                Selecionado
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            ID: {template.id_template}
                          </p>
                          
                          {template.json_data?.category && (
                            <div className="mt-2 flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">
                                {template.json_data.category}
                              </Badge>
                              {template.json_data?.languageCode && (
                                <Badge variant="outline" className="text-xs">
                                  {template.json_data.languageCode}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-[30px] w-[30px] p-0 flex-shrink-0"
                          onClick={(e) => togglePreview(template.id, e)}
                        >
                          {isExpanded ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {isExpanded && (
                        <>
                          <Separator className="my-4" />
                          <WhatsappTemplateDetails 
                            template={template} 
                            showLabel={false}
                          />
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsappTemplatePickerModal;
