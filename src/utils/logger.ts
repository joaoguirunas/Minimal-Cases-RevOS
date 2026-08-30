/**
 * Sistema de logging estruturado para debugging e monitoramento de performance
 */

export const logger = {
  auth: (msg: string, data?: any) => {
    console.log(`🔐 [AUTH ${new Date().toISOString()}] ${msg}`, data || '');
  },
  
  db: (msg: string, data?: any) => {
    console.log(`💾 [DB ${new Date().toISOString()}] ${msg}`, data || '');
  },
  
  perf: (label: string, duration: number) => {
    console.log(`⚡ [PERF] ${label}: ${duration.toFixed(2)}ms`);
  },
  
  error: (msg: string, error?: any) => {
    console.error(`❌ [ERROR] ${msg}`, error || '');
  },
  
  info: (msg: string, data?: any) => {
    console.log(`ℹ️ [INFO] ${msg}`, data || '');
  },
  
  warn: (msg: string, data?: any) => {
    console.warn(`⚠️ [WARN] ${msg}`, data || '');
  }
};
