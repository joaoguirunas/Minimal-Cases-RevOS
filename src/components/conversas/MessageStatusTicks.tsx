import { Check, X } from 'lucide-react';

interface MessageStatusTicksProps {
  status: string;
}

export const MessageStatusTicks = ({ status }: MessageStatusTicksProps) => {
  switch (status) {
    case 'pending':
      return (
        <div className="flex items-center gap-0.5">
          <Check className="w-3 h-3 text-muted-foreground" />
        </div>
      );
    case 'sent':
    case 'delivered':
    case 'read':
      return (
        <div className="flex items-center gap-0.5">
          <Check className="w-3 h-3 text-green-600" />
          <Check className="w-3 h-3 text-green-600 -ml-2" />
        </div>
      );
    case 'error':
      return (
        <div className="flex items-center gap-0.5">
          <X className="w-3 h-3 text-destructive" />
        </div>
      );
    default:
      return null;
  }
};