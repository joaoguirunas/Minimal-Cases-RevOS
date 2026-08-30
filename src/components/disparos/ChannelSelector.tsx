import { MessageCircle, Mail, Smartphone, Phone, Bot } from 'lucide-react';
import { SendChannelUi, SEND_CHANNELS } from '@/types/sends';
import { cn } from '@/lib/utils';

interface ChannelSelectorProps {
  value: SendChannelUi | null;
  onChange: (channel: SendChannelUi) => void;
}

const CHANNEL_ICONS: Record<SendChannelUi, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  email: Mail,
  sms: Smartphone,
  phone: Phone,
  voice_ai: Bot,
};

const CHANNEL_STYLE: Record<SendChannelUi, { icon: string; active: string }> = {
  whatsapp: { icon: 'text-green-600 bg-green-500/10',  active: 'border-green-500/60 bg-green-500/5' },
  email:    { icon: 'text-blue-600 bg-blue-500/10',    active: 'border-blue-500/60 bg-blue-500/5' },
  sms:      { icon: 'text-orange-600 bg-orange-500/10',active: 'border-orange-500/60 bg-orange-500/5' },
  phone:    { icon: 'text-purple-600 bg-purple-500/10',active: 'border-purple-500/60 bg-purple-500/5' },
  voice_ai: { icon: 'text-violet-600 bg-violet-500/10',active: 'border-violet-500/60 bg-violet-500/5' },
};

export default function ChannelSelector({ value, onChange }: ChannelSelectorProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {SEND_CHANNELS.map((ch) => {
        const Icon = CHANNEL_ICONS[ch.id];
        const isSelected = value === ch.id;
        const style = CHANNEL_STYLE[ch.id];

        return (
          <button
            key={ch.id}
            type="button"
            onClick={() => onChange(ch.id)}
            className={cn(
              'flex items-center gap-2.5 px-3.5 py-3 rounded-[4px] border text-left transition-all',
              isSelected
                ? style.active
                : 'border-border bg-card hover:border-primary/30 hover:bg-white/[0.035]'
            )}
          >
            <div className={cn('w-8 h-8 rounded-[4px] flex items-center justify-center shrink-0', style.icon)}>
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium leading-tight text-foreground">
                {ch.label}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                {ch.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
