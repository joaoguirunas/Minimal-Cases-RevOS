import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Card para acessar a demo de conversa com Eduardo Freitas
 * Útil para apresentações e testes
 */
export function DemoAccessCard() {
  const navigate = useNavigate();

  return (
    <Card className="border-dashed border-2 border-blue-300/40 bg-gradient-to-br from-blue-50/30 to-blue-50/10 p-4">
      <div className="flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-blue-500 flex-shrink-0 mt-1" />

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground">Visualizar Demo</h3>
            <Badge variant="outline" className="text-xs">NOVO</Badge>
          </div>

          <p className="text-sm text-muted-foreground mb-3">
            Confira uma simulação de conversa realista com Eduardo Freitas via Instagram DM.
            Perfeito para entender como o OMNI PRO funciona.
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/omni/demo')}
            className="gap-2"
          >
            Ver Demo
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
