-- ORA: Fix step control
-- Step estava com control='recomendacao' mas leads usam control='1'
-- loadStep faz .eq('control', control) — sem match = step prompt nunca carrega
-- Agent ID: 4906fcb7-2057-4007-b946-4a652aea6b9f
-- Step ID:  12839791-eb76-474b-aaa9-49d5af1c5ac7

UPDATE ai_agents_steps
SET control = '1'
WHERE id = '12839791-eb76-474b-aaa9-49d5af1c5ac7';
