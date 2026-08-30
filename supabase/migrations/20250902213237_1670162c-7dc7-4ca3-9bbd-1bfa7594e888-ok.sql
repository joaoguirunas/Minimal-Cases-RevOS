-- Fix security warnings by adding SET search_path to functions
ALTER FUNCTION prevent_message_duplicates() SET search_path = 'public';
ALTER FUNCTION log_duplicate_attempt() SET search_path = 'public';