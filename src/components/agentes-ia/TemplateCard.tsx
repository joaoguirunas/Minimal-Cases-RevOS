import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, ListOrdered, Zap, Calendar, Megaphone, Target,
  Share2, RefreshCw, HeartHandshake, Stethoscope, ExternalLink,
  Cpu, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useClonarAgente } from '@/hooks/useAgentesIAReal';
import type { AgenteIA } from '@/hooks/useAgentesIAReal';

type TemplateMeta = {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  badge: string;
};

const TEMPLATE_META: Record<string, TemplateMeta> = {
  diagnostico:      { icon: Stethoscope,  color: 'text-violet-500',  bg: 'bg-violet-500/10',  badge: 'Diagnóstico' },
  sdr_outbound:     { icon: Megaphone,    color: 'text-orange-500',  bg: 'bg-orange-500/10',  badge: 'SDR' },
  triagem:          { icon: Zap,          color: 'text-amber-500',   bg: 'bg-amber-500/10',   badge: 'Triagem' },
  qualificacao_bant:{ icon: ListOrdered,  color: 'text-blue-500',    bg: 'bg-blue-500/10',    badge: 'BANT' },
  agendamento:      { icon: Calendar,     color: 'text-emerald-500', bg: 'bg-emerald-500/10', badge: 'Agendamento' },
  closer:           { icon: Target,       color: 'text-red-500',     bg: 'bg-red-500/10',     badge: 'Closer' },
  social_selling:   { icon: Share2,       color: 'text-pink-500',    bg: 'bg-pink-500/10',    badge: 'Social' },
  reativacao:       { icon: RefreshCw,    color: 'text-cyan-500',    bg: 'bg-cyan-500/10',    badge: 'Reativação' },
  customer_success: { icon: HeartHandshake, color: 'text-teal-500',  bg: 'bg-teal-500/10',   badge: 'CS' },
  qualificacao:     { icon: ListOrdered,  color: 'text-blue-500',    bg: 'bg-blue-500/10',    badge: 'Qualificação' },
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  instagram_dm: 'Instagram',
  email: 'Email',
  sms: 'SMS',
};

interface TemplateCardProps {
  template: AgenteIA;
  onCloned?: (newAgentId: string) => void;
}

export const TemplateCard = ({ template, onCloned }: TemplateCardProps) => {
  const navigate = useNavigate();
  const clonarMutation = useClonarAgente();
  const [loading, setLoading] = useState(false);

  const meta = template.template_type ? TEMPLATE_META[template.template_type] : null;
  const Icon = meta?.icon ?? Bot;

  const handleUseTemplate = async () => {
    setLoading(true);
    try {
      const newAgent = await clonarMutation.mutateAsync(template.id);
      if (onCloned) {
        onCloned(newAgent.id);
      } else {
        navigate(`/settings/crm/aiagents/${newAgent.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Build config tags
  const tags: string[] = [];
  if (template.channel_types?.length) {
    tags.push(template.channel_types.map(c => CHANNEL_LABELS[c] || c).join(', '));
  }
  if (template.llm_model) {
    tags.push(template.llm_model);
  }
  if (template.humanizacao && template.humanizacao !== 'nenhuma') {
    tags.push(`Humanização ${template.humanizacao}`);
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-[4px] border border-border bg-card hover:border-border transition-all duration-300">
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-[4px] shrink-0 ${meta?.bg ?? 'bg-muted'}`}>
          <Icon className={`h-5 w-5 ${meta?.color ?? 'text-muted-foreground'}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-foreground leading-tight">
              {template.nome}
            </span>
            {meta && (
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-[2px] ${meta.bg} ${meta.color}`}>
                {meta.badge}
              </span>
            )}
          </div>
          {template.descricao && (
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
              {template.descricao}
            </p>
          )}
        </div>
      </div>

      {/* Config preview tags */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70 bg-card px-1.5 py-0.5 rounded-[2px]"
            >
              {tag === template.llm_model ? (
                <Cpu className="h-2.5 w-2.5" />
              ) : tag.startsWith('Humanização') ? (
                <MessageSquare className="h-2.5 w-2.5" />
              ) : null}
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => navigate(`/settings/crm/aiagents/${template.id}`)}
          className="h-[30px] text-xs gap-1.5 text-muted-foreground hover:text-foreground px-2.5"
        >
          <ExternalLink className="h-3 w-3" />
          Editar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleUseTemplate}
          disabled={loading}
          className="flex-1 h-[30px] text-[12px] gap-1.5 border-border hover:border-primary/40 hover:text-primary hover:bg-primary/5"
        >
          {loading ? 'Criando...' : 'Usar template'}
        </Button>
      </div>
    </div>
  );
};
