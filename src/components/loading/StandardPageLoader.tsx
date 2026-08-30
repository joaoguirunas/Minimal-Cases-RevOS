import React from 'react';
import { cn } from '@/lib/utils';
import { Loader } from 'lucide-react';

interface StandardPageLoaderProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  className?: string;
  showIcon?: boolean;
}

const StandardPageLoader: React.FC<StandardPageLoaderProps> = ({
  message = 'Carregando...',
  size = 'medium',
  className,
  showIcon = true
}) => {
  const sizeClasses = {
    small: 'h-6 w-6',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  const containerClasses = {
    small: 'gap-2',
    medium: 'gap-3',
    large: 'gap-4'
  };

  const textClasses = {
    small: 'text-sm',
    medium: 'text-sm',
    large: 'text-base'
  };

  return (
    <div className={cn(
      'flex flex-col items-center justify-center',
      containerClasses[size],
      className
    )}>
      {showIcon && (
        <div className={cn(
          'animate-spin rounded-full border-2 border-border border-t-primary',
          sizeClasses[size]
        )} />
      )}
      <p className={cn(
        'text-muted-foreground font-medium animate-pulse',
        textClasses[size]
      )}>
        Carregando...
      </p>
    </div>
  );
};

export default StandardPageLoader;