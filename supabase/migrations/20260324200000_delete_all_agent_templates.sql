-- ╔════════════════════════════════════════════════════════════════════════════╗
-- ║  Delete ALL agent templates                                              ║
-- ║  Removes 7 templates: triagem, qualificacao, agendamento,               ║
-- ║    sdr_outbound, closer, reativacao, customer_success                    ║
-- ║  Will be recreated one-by-one with new structure                         ║
-- ╚════════════════════════════════════════════════════════════════════════════╝

-- Step 1: Delete steps associated with template agents
DELETE FROM public.ai_agents_steps
WHERE ai_agent_id IN (
  SELECT id FROM public.ai_agents WHERE is_template = true
);

-- Step 2: Delete all template agents
DELETE FROM public.ai_agents
WHERE is_template = true;
