
import React, { Component, ReactNode, ErrorInfo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface AdvancedErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level: 'page' | 'section' | 'component';
  recovery?: {
    attempts: number;
    delay: number;
    autoRecover: boolean;
  };
}

interface AdvancedErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  recoveryAttempts: number;
  isRecovering: boolean;
  errorId: string;
}

class AdvancedErrorBoundary extends Component<
  AdvancedErrorBoundaryProps,
  AdvancedErrorBoundaryState
> {
  private recoveryTimer?: NodeJS.Timeout;

  constructor(props: AdvancedErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      recoveryAttempts: 0,
      isRecovering: false,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AdvancedErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AdvancedErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Send error to monitoring service
    this.reportError(error, errorInfo);

    // Auto recovery if enabled
    if (this.props.recovery?.autoRecover && 
        this.state.recoveryAttempts < (this.props.recovery?.attempts || 3)) {
      this.attemptRecovery();
    }
  }

  componentWillUnmount() {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    const errorReport = {
      errorId: this.state.errorId,
      level: this.props.level,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      errorInfo: {
        componentStack: errorInfo.componentStack
      },
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to Sentry, LogRocket, etc.
      console.error('Error Report:', errorReport);
    } else {
      console.error('Development Error:', errorReport);
    }
  };

  private attemptRecovery = () => {
    if (this.state.recoveryAttempts >= (this.props.recovery?.attempts || 3)) {
      return;
    }

    this.setState({ isRecovering: true });

    this.recoveryTimer = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        recoveryAttempts: prevState.recoveryAttempts + 1,
        isRecovering: false
      }));
    }, this.props.recovery?.delay || 2000);
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      recoveryAttempts: 0,
      isRecovering: false,
      errorId: ''
    });
  };

  private handleGoHome = () => {
    window.location.href = '/bipro';
  };

  private handleReportBug = () => {
    const subject = encodeURIComponent(`Bug Report - ${this.state.errorId}`);
    const body = encodeURIComponent(`
Error ID: ${this.state.errorId}
Error: ${this.state.error?.message}
Level: ${this.props.level}
URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}

Steps to reproduce:
1. 
2. 
3. 

Expected behavior:

Actual behavior:
${this.state.error?.message}
    `);
    
    window.open(`mailto:support@example.com?subject=${subject}&body=${body}`);
  };

  private renderErrorFallback = () => {
    const { level } = this.props;
    const { error, errorId, isRecovering } = this.state;

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const levelConfig = {
      page: {
        title: 'Oops! Algo deu errado',
        description: 'A página encontrou um erro inesperado.',
        showHome: true
      },
      section: {
        title: 'Erro nesta seção',
        description: 'Esta seção não pôde ser carregada.',
        showHome: false
      },
      component: {
        title: 'Componente indisponível',
        description: 'Este componente encontrou um erro.',
        showHome: false
      }
    };

    const config = levelConfig[level];

    return (
      <Card className="p-6 m-4 border-red-200 bg-red-50 rounded-[4px]">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              {config.title}
            </h3>
            <p className="text-red-700 mb-4">
              {config.description}
            </p>
            
            {process.env.NODE_ENV === 'development' && (
              <details className="mb-4 p-3 bg-red-100 rounded-[4px] border border-red-200">
                <summary className="cursor-pointer font-medium text-red-800">
                  Detalhes do erro (desenvolvimento)
                </summary>
                <pre className="mt-2 text-xs text-red-700 overflow-auto">
                  {error?.stack}
                </pre>
              </details>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={this.handleRetry}
                disabled={isRecovering}
                className="bg-red-600 hover:bg-red-700 text-white rounded-[4px]"
              >
                {isRecovering ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Recuperando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Tentar Novamente
                  </>
                )}
              </Button>

              {config.showHome && (
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-100 rounded-[4px]"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Ir para Home
                </Button>
              )}

              <Button
                onClick={this.handleReportBug}
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100 rounded-[4px]"
              >
                <Bug className="w-4 h-4 mr-2" />
                Reportar Bug
              </Button>
            </div>

            <p className="text-xs text-red-600 mt-4">
              ID do erro: {errorId}
            </p>
          </div>
        </div>
      </Card>
    );
  };

  render() {
    if (this.state.hasError) {
      return this.renderErrorFallback();
    }

    return this.props.children;
  }
}

export default AdvancedErrorBoundary;
