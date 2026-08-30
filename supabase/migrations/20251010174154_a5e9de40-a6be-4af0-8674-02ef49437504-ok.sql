-- Add foreign key constraint from security_audit_logs to settings_users
ALTER TABLE public.security_audit_logs
ADD CONSTRAINT security_audit_logs_users_id_fkey 
FOREIGN KEY (users_id) 
REFERENCES public.settings_users(id) 
ON DELETE SET NULL;