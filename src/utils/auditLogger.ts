import { supabase } from '@/integrations/supabase/client';

interface AuditLogParams {
  action: string;
  resource_type: string;
  resource_id?: string | null;
  details?: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
}

class AuditLogger {
  private async getCurrentUserId(): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data } = await supabase
        .from('settings_users')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
      
      return data?.id || null;
    } catch (error) {
      console.warn('⚠️ AuditLogger: Failed to get user ID:', error);
      return null;
    }
  }

  private getClientInfo() {
    return {
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      ip_address: null // IP será capturado pelo backend se necessário
    };
  }

  async log(params: AuditLogParams): Promise<void> {
    // Audit logging disabled - security_audit_logs table was removed
    console.log('📝 Audit log (disabled):', params.action, params.resource_type);
  }

  async logBatch(logs: AuditLogParams[]): Promise<void> {
    // Audit logging disabled - security_audit_logs table was removed
    console.log(`📝 Batch audit log (disabled): ${logs.length} entries`);
  }
}

export const auditLogger = new AuditLogger();
