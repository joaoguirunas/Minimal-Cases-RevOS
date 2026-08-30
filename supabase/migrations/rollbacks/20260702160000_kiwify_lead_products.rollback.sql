-- Rollback for 20260702160000_kiwify_lead_products.sql (KFY-2.2)
BEGIN;
DROP TABLE IF EXISTS public.kiwify_lead_products CASCADE;
COMMIT;
