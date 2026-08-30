import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ArrowDown, GitMerge, Phone, Mail, Instagram } from 'lucide-react';
import { formatPhoneDisplay } from '@/utils/phoneUtils';
import { cn } from '@/lib/utils';
import { ContactAvatar } from '@/components/ui/contact-avatar';
import { DuplicatePerson } from '@/hooks/useCheckDuplicate';

interface CurrentContact {
  id?: string;
  name: string;
  whatsapp?: string | null;
  email?: string | null;
  instagram_handle?: string | null;
  instagram_user_id?: string | null;
  profile_picture?: string | null;
}

interface MergeContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: CurrentContact;
  duplicate: DuplicatePerson;
  conflictField: 'whatsapp' | 'email' | 'instagram';
  onConfirmMerge: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  instagram: 'Instagram',
};

function MergeAvatar({ contact, size = 'md' }: { contact: CurrentContact | DuplicatePerson; size?: 'sm' | 'md' }) {
  return (
    <ContactAvatar
      src={contact.profile_picture}
      name={contact.name}
      size={size === 'md' ? 'md' : 'sm'}
      className={cn("border border-white/[0.06]", size === 'md' ? 'h-10 w-10' : '')}
    />
  );
}

function ContactRow({
  contact,
  conflictField,
  label,
  variant = 'default',
}: {
  contact: CurrentContact | DuplicatePerson;
  conflictField: 'whatsapp' | 'email' | 'instagram';
  label: string;
  variant?: 'default' | 'existing';
}) {
  const isExisting = variant === 'existing';
  return (
    <div className={cn(
      "flex items-start gap-3 rounded-[4px] border p-3",
      isExisting
        ? "bg-primary/5 border-primary/20"
        : "bg-muted border-border",
    )}>
      <MergeAvatar contact={contact} />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5">
          {isExisting && (
            <span className="text-[9px] font-semibold uppercase tracking-widest text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-sm">
              existente
            </span>
          )}
          <span className="text-sm font-semibold text-foreground truncate">{contact.name}</span>
        </div>

        <div className="space-y-0.5">
          {contact.whatsapp && (
            <div className={cn(
              "flex items-center gap-1.5 text-xs",
              conflictField === 'whatsapp' ? "text-amber-500 font-medium" : "text-muted-foreground",
            )}>
              <Phone className="w-3 h-3 shrink-0" />
              <span>{formatPhoneDisplay(contact.whatsapp)}</span>
            </div>
          )}
          {contact.email && (
            <div className={cn(
              "flex items-center gap-1.5 text-xs",
              conflictField === 'email' ? "text-amber-500 font-medium" : "text-muted-foreground",
            )}>
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {(contact.instagram_handle || contact.instagram_user_id) && (
            <div className={cn(
              "flex items-center gap-1.5 text-xs",
              conflictField === 'instagram' ? "text-amber-500 font-medium" : "text-muted-foreground",
            )}>
              <Instagram className="w-3 h-3 shrink-0" />
              <span>@{contact.instagram_handle || contact.instagram_user_id}</span>
            </div>
          )}
          {!contact.whatsapp && !contact.email && !contact.instagram_handle && !contact.instagram_user_id && (
            <span className="text-xs text-muted-foreground/40 italic">Sem contatos</span>
          )}
        </div>
      </div>
    </div>
  );
}

export const MergeContactModal = ({
  open,
  onOpenChange,
  current,
  duplicate,
  conflictField,
  onConfirmMerge,
  onCancel,
  isLoading = false,
}: MergeContactModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
              <GitMerge className="w-4 h-4 text-amber-500" />
            </div>
            <DialogTitle className="text-base font-semibold">Contato duplicado</DialogTitle>
          </div>
          <p className="text-[12px] text-muted-foreground leading-relaxed pl-11">
            O <span className="font-medium text-foreground">{FIELD_LABELS[conflictField]}</span> informado
            já pertence a outro contato. Deseja unificar os dois registros?
          </p>
        </DialogHeader>

        {/* Contact comparison */}
        <div className="px-5 pb-5 space-y-2">
          <ContactRow contact={current} conflictField={conflictField} label="atual" />

          <div className="flex items-center gap-3 px-1">
            <div className="flex-1 h-px bg-border/50" />
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50 uppercase tracking-widest">
              <ArrowDown className="w-3 h-3" />
              unificar em
            </div>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          <ContactRow contact={duplicate} conflictField={conflictField} label="existente" variant="existing" />

          <p className="text-[11px] text-muted-foreground/50 pt-1 text-center">
            Todo o histórico de conversas será vinculado ao contato existente.
          </p>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={onConfirmMerge}
              disabled={isLoading}
              className="flex-1 gap-1.5"
            >
              <GitMerge className="w-3.5 h-3.5" />
              {isLoading ? 'Unificando...' : 'Unificar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MergeContactModal;
