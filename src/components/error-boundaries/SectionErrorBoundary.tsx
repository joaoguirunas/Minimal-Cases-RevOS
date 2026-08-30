
import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error in ${this.props.section || 'Section'}:`, error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Callback personalizado para logging
    this.props.onError?.(error, errorInfo);

    // Envio para serviço de monitoramento (implementar conforme necessário)
    // this.logErrorToService(error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Implementar integração com serviço de monitoramento
    // Ex: Sentry, LogRocket, etc.
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      section: this.props.section,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    console.error('Error logged:', errorData);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="p-6 m-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">
                Erro na seção {this.props.section}
              </h3>
              <p className="text-sm text-red-700">
                Algo deu errado ao carregar esta seção.
              </p>
            </div>
          </div>

          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mb-4 p-3 bg-red-100 rounded-[4px] border border-red-200">
              <p className="text-xs text-red-800 font-mono break-all">
                {this.state.error.message}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={this.handleRetry}
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Tentar Novamente
            </Button>
            
            <Button
              onClick={() => window.location.reload()}
              size="sm"
              variant="ghost"
              className="text-red-700 hover:bg-red-100"
            >
              Recarregar Página
            </Button>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default SectionErrorBoundary;
