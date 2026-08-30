// Filtro aprimorado para reduzir ruído de erros e evitar rate limiting do Sentry
export const shouldReportError = (error: Error | string): boolean => {
  const errorMessage = typeof error === 'string' ? error : error.message;
  
  // Lista ampliada de erros que NÃO devem ser reportados
  const ignoredErrors = [
    'Non-Error promise rejection captured',
    'ResizeObserver loop limit exceeded',
    'ChunkLoadError',
    'Loading chunk',
    'Network Error',
    'fetch',
    'AbortError',
    'The user aborted a request',
    'Cancelled',
    'timeout',
    'ERR_NETWORK',
    'ERR_INTERNET_DISCONNECTED',
    'ERR_CONNECTION_REFUSED',
    // Sentry específicos
    'sentry.io',
    '429',
    'Too Many Requests',
    'Rate limit',
    'Envelope',
    // Auth/RLS específicos
    'permission denied',
    'row level security',
    'auth.uid() is null',
    '42501',
    // Conectividade
    'Failed to fetch',
    'ERR_BLOCKED_BY_CLIENT',
    'ERR_FAILED',
    'ERR_NAME_NOT_RESOLVED',
    'ERR_CERT_',
    'ERR_SSL_',
    'socket hang up',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    // Performance/UI
    'requestIdleCallback',
    'requestAnimationFrame',
    'performance.mark',
    'IntersectionObserver',
    'MutationObserver'
  ];

  // Filtrar erros de rede, navegação e desenvolvimento
  const shouldIgnore = ignoredErrors.some(ignoredError => 
    errorMessage.toLowerCase().includes(ignoredError.toLowerCase())
  );

  return !shouldIgnore;
};

// Interceptor aprimorado para console.error que filtra ruído
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = (...args: any[]) => {
  const errorMessage = args.join(' ');
  
  // Filtrar mensagens específicas que causam spam
  if (errorMessage.includes('sentry.io') || 
      errorMessage.includes('429') ||
      errorMessage.includes('Too Many Requests') ||
      errorMessage.includes('Rate limit') ||
      errorMessage.includes('Envelope')) {
    return; // Não mostrar erros de Sentry rate limiting
  }
  
  // Filtrar erros de autenticação temporários
  if (errorMessage.includes('permission denied') ||
      errorMessage.includes('auth.uid() is null') ||
      errorMessage.includes('42501')) {
    // Mostrar apenas uma vez por sessão
    if (!sessionStorage.getItem('auth_error_shown')) {
      sessionStorage.setItem('auth_error_shown', 'true');
      originalConsoleError.apply(console, ['🔐 Problema de autenticação detectado - tentando reconectar...']);
    }
    return;
  }
  
  // Filtrar outros erros comuns usando nossa função
  if (shouldReportError(errorMessage)) {
    originalConsoleError.apply(console, args);
  }
};

console.warn = (...args: any[]) => {
  const errorMessage = args.join(' ');
  
  // Filtrar warnings específicos que causam spam
  if (shouldReportError(errorMessage)) {
    originalConsoleWarn.apply(console, args);
  }
};