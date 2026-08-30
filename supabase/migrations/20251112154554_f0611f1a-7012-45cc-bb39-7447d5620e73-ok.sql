-- Add loss reason columns to leads table
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS leads_loss_reasons_id UUID REFERENCES public.leads_loss_reasons(id),
ADD COLUMN IF NOT EXISTS loss_reason TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_loss_reasons_id ON public.leads(leads_loss_reasons_id);

COMMENT ON COLUMN public.leads.leads_loss_reasons_id IS 'Foreign key to the loss reason from leads_loss_reasons table';
COMMENT ON COLUMN public.leads.loss_reason IS 'Additional text notes about why the deal was lost';