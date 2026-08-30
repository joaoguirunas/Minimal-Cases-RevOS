
import React from 'react';
import { cn } from '@/lib/utils';

interface LoaderProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  className?: string;
  overlay?: boolean;
  variant?: 'spinner' | 'skeleton' | 'pulse';
}

const Loader: React.FC<LoaderProps> = ({
  size = 'medium',
  message,
  className,
  overlay = false,
  variant = 'spinner'
}) => {
  const sizeClasses = {
    small: 'h-4 w-4',
    medium: 'h-8 w-8',
    large: 'h-12 w-12'
  };

  const containerClasses = cn(
    'flex flex-col items-center justify-center gap-3',
    overlay && 'absolute inset-0 bg-background/80 backdrop-blur-sm z-50',
    className
  );

  const renderLoader = () => {
    switch (variant) {
      case 'skeleton':
        return (
          <div className="space-y-3 w-full max-w-sm">
            <div className="h-4 bg-muted rounded-[4px] animate-pulse" />
            <div className="h-4 bg-muted rounded-[4px] animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded-[4px] animate-pulse w-1/2" />
          </div>
        );

      case 'pulse':
        return (
          <div className={cn(
            'bg-primary rounded-[4px] animate-pulse',
            sizeClasses[size]
          )} />
        );

      default:
        return (
          <div className={cn(
            'animate-spin rounded-full border-2 border-border border-t-primary',
            sizeClasses[size]
          )} />
        );
    }
  };

  return (
    <div className={containerClasses}>
      {renderLoader()}
      {message && (
        <p className="text-muted-foreground text-sm font-medium animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
};

export default Loader;
