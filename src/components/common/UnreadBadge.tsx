import { MessageCircle } from 'lucide-react';

interface UnreadBadgeProps {
  /** clients_people.unread_count — inbound messages with seen_at IS NULL. */
  count?: number | null;
  /** clients_people.first_unread_at — oldest open inbound, drives the waiting label. */
  since?: string | null;
  /** `pill` = compact counter for the Omni list; `chip` = kanban card chips row. */
  variant?: 'pill' | 'chip';
}

const CHIP_BASE =
  'inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md border leading-none';

/** Compact elapsed time since the oldest unread arrived: "12m", "3h", "2d". */
function waitingLabel(since: string): string | null {
  const started = new Date(since).getTime();
  if (Number.isNaN(started)) return null;

  const minutes = Math.floor((Date.now() - started) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function UnreadBadge({ count, since, variant = 'pill' }: UnreadBadgeProps) {
  if (!count || count <= 0) return null;

  const display = count > 99 ? '99+' : String(count);
  const waiting = since ? waitingLabel(since) : null;
  const plural = count === 1 ? 'mensagem não lida' : 'mensagens não lidas';
  const title = waiting ? `${count} ${plural} — esperando há ${waiting}` : `${count} ${plural}`;

  if (variant === 'chip') {
    return (
      <span
        className={`${CHIP_BASE} text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20`}
        title={title}
      >
        <MessageCircle className="h-2.5 w-2.5 shrink-0" strokeWidth={1.5} />
        {display}
        {waiting && <span className="text-[#EF4444]/60">·{waiting}</span>}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-semibold leading-none tabular-nums"
      title={title}
    >
      {display}
    </span>
  );
}
