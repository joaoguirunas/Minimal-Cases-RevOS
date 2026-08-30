
import { lazy, Suspense, Component, ReactNode, ComponentType } from 'react';
import LoadingSpinner from '@/components/ui/loading-spinner';

interface LazyComponentLoaderProps {
  loader: () => Promise<{ default: ComponentType<any> }>;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
  delay?: number;
}

interface LazyLoaderState {
  hasError: boolean;
  error?: Error;
  isLoading: boolean;
}

class LazyComponentLoader extends Component<LazyComponentLoaderProps, LazyLoaderState> {
  private loadingTimer?: NodeJS.Timeout;

  constructor(props: LazyComponentLoaderProps) {
    super(props);
    this.state = {
      hasError: false,
      isLoading: true
    };
  }

  componentDidMount() {
    // Add artificial delay if specified
    if (this.props.delay) {
      this.loadingTimer = setTimeout(() => {
        this.setState({ isLoading: false });
      }, this.props.delay);
    } else {
      this.setState({ isLoading: false });
    }
  }

  componentWillUnmount() {
    if (this.loadingTimer) {
      clearTimeout(this.loadingTimer);
    }
  }

  static getDerivedStateFromError(error: Error): LazyLoaderState {
    return {
      hasError: true,
      error,
      isLoading: false
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('LazyComponentLoader caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.errorFallback || (
        <div className="flex items-center justify-center p-8 text-red-600 bg-red-50 rounded-[4px] border border-red-200">
          <div className="text-center">
            <p className="font-medium">Erro ao carregar componente</p>
            <p className="text-sm text-red-500 mt-1">
              {this.state.error?.message || 'Erro desconhecido'}
            </p>
          </div>
        </div>
      );
    }

    if (this.state.isLoading) {
      return this.props.fallback || (
        <div className="flex items-center justify-center p-8">
          <LoadingSpinner size="medium" />
        </div>
      );
    }

    const LazyComponent = lazy(this.props.loader);

    return (
      <Suspense fallback={this.props.fallback || <LoadingSpinner size="medium" />}>
        <LazyComponent />
      </Suspense>
    );
  }
}

export default LazyComponentLoader;

// Hook para lazy loading com prefetch
export const useLazyLoading = () => {
  const prefetchComponent = (loader: () => Promise<any>) => {
    // Prefetch the component in the background
    const prefetch = () => {
      loader().catch((error) => {
        console.warn('Component prefetch failed:', error);
      });
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(prefetch);
    } else {
      setTimeout(prefetch, 100);
    }
  };

  return { prefetchComponent };
};
