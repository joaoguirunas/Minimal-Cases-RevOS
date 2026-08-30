
import React from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  className?: string;
  inline?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  message,
  className,
  inline = false
}) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-6 w-6',
    large: 'h-8 w-8'
  };

  const containerClasses = inline 
    ? 'flex items-center gap-2'
    : 'flex flex-col items-center justify-center gap-3';

  return (
    <div className={cn(containerClasses, className)}>
      <div className={cn(
        'animate-spin rounded-full border-2 border-border border-t-primary',
        sizeClasses[size]
      )} />
      {message && (
        <p className="text-muted-foreground text-sm font-medium">
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingSpinner;
