import { Check, Settings, Database, User, FileText, Layers, Plus, Minus, Edit, Brain, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { parseChangelog, type ChangelogData } from '@/utils/changeDetection';

interface ChangelogDisplayProps {
  changelog: string;
  compact?: boolean;
  aiAnalysis?: string | null;
  modelUsed?: string;
}

export const ChangelogDisplay = ({ changelog, compact = false, aiAnalysis, modelUsed }: ChangelogDisplayProps) => {
  const changelogData = parseChangelog(changelog);
  
  if (!changelogData) {
    return (
      <div className="text-sm text-muted-foreground bg-muted p-3 rounded-[2px]">
        <strong>Changelog:</strong> {changelog}
      </div>
    );
  }

  const areaIcons = {
    configuracao: Settings,
    dados_entrada: Database,
    identidade: User,
    regras_gerais: FileText,
    prompt_base: FileText,
    etapas: Layers,
  };

  const areaNames = {
    configuracao: 'Configuração',
    dados_entrada: 'Dados de Entrada',
    identidade: 'Identidade',
    regras_gerais: 'Regras Gerais',
    prompt_base: 'Prompt Base',
    etapas: 'Etapas',
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground">
          {changelogData.resumo}
        </div>
        
        <div className="flex flex-wrap gap-1">
          {changelogData.areas_alteradas.map((area) => {
            const Icon = areaIcons[area as keyof typeof areaIcons];
            const areaName = areaNames[area as keyof typeof areaNames] || area;
            
            if (!Icon) return null;
            
            return (
              <Badge 
                key={area} 
                variant="secondary" 
                className="text-xs flex items-center gap-1"
              >
                <Check className="h-3 w-3 text-green-600" />
                <Icon className="h-3 w-3" />
                {areaName}
              </Badge>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Card className="bg-muted">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Edit className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm">Alterações Realizadas</h4>
        </div>
        
        <div className="text-sm font-medium text-foreground mb-3">
          {changelogData.resumo}
        </div>

        <div className="space-y-3">
          {changelogData.detalhes && Object.entries(changelogData.detalhes).map(([area, details]) => {
            const Icon = areaIcons[area as keyof typeof areaIcons];
            const areaName = areaNames[area as keyof typeof areaNames] || area;
            
            if (!Icon) return null;
            
            return (
              <div key={area} className="border-l-2 border-primary/20 pl-3">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="h-3 w-3 text-green-600" />
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{areaName}</span>
                  <Badge variant="outline" className="text-xs">
                    {details.tipo}
                  </Badge>
                </div>
                
                <div className="text-xs text-muted-foreground mb-1">
                  {details.resumo}
                </div>
                
                {details.detalhes && details.detalhes.length > 0 && (
                  <div className="space-y-1">
                    {details.detalhes.map((detalhe, index) => {
                      const isAddition = detalhe.startsWith('+');
                      const isRemoval = detalhe.startsWith('-');
                      const isModification = detalhe.startsWith('~');
                      
                      return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                          {isAddition && <Plus className="h-3 w-3 text-green-600" />}
                          {isRemoval && <Minus className="h-3 w-3 text-red-600" />}
                          {isModification && <Edit className="h-3 w-3 text-blue-600" />}
                          {!isAddition && !isRemoval && !isModification && 
                            <span className="w-3 h-3" />
                          }
                          <span className={`
                            ${isAddition ? 'text-green-700' : ''}
                            ${isRemoval ? 'text-red-700' : ''}
                            ${isModification ? 'text-blue-700' : ''}
                            ${!isAddition && !isRemoval && !isModification ? 'text-muted-foreground' : ''}
                          `}>
                            {detalhe.replace(/^[+\-~]\s*/, '')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Análise IA */}
        {aiAnalysis && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center space-x-2 mb-4">
              <Brain className="w-5 h-5 text-primary" />
              <h4 className="font-semibold text-foreground">Análise IA</h4>
              {modelUsed && (
                <Badge variant="secondary" className="text-xs">
                  {modelUsed}
                </Badge>
              )}
            </div>
            <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap">
              {aiAnalysis}
            </div>
          </div>
        )}

        {/* Indicador de falta de conexão */}
        {!aiAnalysis && !compact && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">
                Configure uma conexão OpenAI ativa para receber análise IA das mudanças
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};