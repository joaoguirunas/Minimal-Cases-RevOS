-- Remover TODOS os triggers antigos da tabela ai_agents_steps
DROP TRIGGER IF EXISTS track_ai_agent_step_changes_trigger ON ai_agents_steps;
DROP TRIGGER IF EXISTS track_ai_agent_stage_changes_trigger ON ai_agents_steps;
DROP TRIGGER IF EXISTS ai_agents_steps_history_trigger ON ai_agents_steps;

-- Criar o trigger correto usando a função handle_ai_agents_steps_history
CREATE TRIGGER ai_agents_steps_history_trigger
  AFTER UPDATE ON ai_agents_steps
  FOR EACH ROW
  EXECUTE FUNCTION handle_ai_agents_steps_history();