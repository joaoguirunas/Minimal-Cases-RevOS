import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

interface ContactAvatarProps {
  src?: string | null;
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  fallbackClassName?: string;
}

const sizeMap = {
  xs: 'h-6 w-6',
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
} as const;

const textSizeMap = {
  xs: 'text-[9px]',
  sm: 'text-[10px]',
  md: 'text-[12px]',
  lg: 'text-[16px]',
} as const;

const iconSizeMap = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
} as const;

function getInitials(name?: string | null): string {
  if (!name) return '';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Unified contact avatar with automatic fallback.
 * Uses Radix Avatar internally — if the image fails to load,
 * it automatically shows initials or a User icon.
 */
export function ContactAvatar({
  src,
  name,
  size = 'md',
  className,
  fallbackClassName,
}: ContactAvatarProps) {
  const initials = getInitials(name);

  return (
    <Avatar className={cn(sizeMap[size], 'shrink-0', className)}>
      {src && <AvatarImage src={src} alt={name || ''} />}
      <AvatarFallback
        className={cn(
          'font-semibold select-none',
          textSizeMap[size],
          fallbackClassName || 'bg-muted text-muted-foreground',
        )}
      >
        {initials || <User className={iconSizeMap[size]} />}
      </AvatarFallback>
    </Avatar>
  );
}
