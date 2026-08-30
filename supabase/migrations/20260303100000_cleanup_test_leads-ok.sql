-- One-time cleanup: remove all test persons/leads created by the AI Agent Test tab
-- Test records are identified by whatsapp field starting with 'TEST'

DELETE FROM ai_agents_execution_log
WHERE people_id IN (SELECT id FROM clients_people WHERE whatsapp LIKE 'TEST%');

DELETE FROM messages
WHERE people_id IN (SELECT id FROM clients_people WHERE whatsapp LIKE 'TEST%');

DELETE FROM lead_field_values
WHERE entity_id IN (SELECT id FROM clients_people WHERE whatsapp LIKE 'TEST%');

DELETE FROM leads
WHERE people_id IN (SELECT id FROM clients_people WHERE whatsapp LIKE 'TEST%');

DELETE FROM clients_people WHERE whatsapp LIKE 'TEST%';
