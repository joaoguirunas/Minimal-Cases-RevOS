-- Corrigir trigger que está referenciando tabela errada
-- O trigger está tentando usar ai_agents_stages_history quando deveria ser ai_agents_steps_history

DROP TRIGGER IF EXISTS track_ai_agent_step_changes_trigger ON ai_agents_steps;

CREATE TRIGGER track_ai_agent_step_changes_trigger
  AFTER UPDATE ON ai_agents_steps
  FOR EACH ROW
  EXECUTE FUNCTION handle_ai_agents_steps_history();