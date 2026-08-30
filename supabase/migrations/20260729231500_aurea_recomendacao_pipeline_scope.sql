BEGIN;

WITH new_team AS (
  INSERT INTO settings_teams (name, description, team_type, active)
  VALUES ('Recomendação', 'Time restrito ao pipeline 6 | Recomendação', 'vendas', true)
  RETURNING id
),
link_pipeline AS (
  INSERT INTO settings_teams_pipelines (team_id, pipeline_id)
  SELECT id, '1393f8c6-21be-43ae-a7f8-dc92762d45b0' FROM new_team
  RETURNING team_id
),
add_member AS (
  INSERT INTO settings_users_teams (user_id, team_id)
  SELECT '7d1d5d8f-f4f2-4729-91b3-a9d5427a1f73', team_id FROM link_pipeline
  RETURNING user_id
)
SELECT 1 FROM add_member;

DROP POLICY IF EXISTS authenticated_read ON messages;
DROP POLICY IF EXISTS authenticated_write ON messages;

CREATE POLICY authenticated_read ON messages FOR SELECT
USING (
  is_admin_or_manager()
  OR EXISTS (
    SELECT 1 FROM clients_people cp
    WHERE cp.id = messages.people_id AND cp.created_by = get_current_settings_user_id()
  )
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.people_id = messages.people_id AND l.user_id = get_current_settings_user_id()
  )
  OR EXISTS (
    SELECT 1 FROM leads l
    JOIN settings_users_teams sut ON sut.team_id = l.teams_id
    WHERE l.people_id = messages.people_id AND sut.user_id = get_current_settings_user_id()
  )
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.people_id = messages.people_id AND lead_pipeline_accessible_to_current_user(l.leads_pipelines_id)
  )
);

CREATE POLICY authenticated_insert ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY authenticated_update ON messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY authenticated_delete ON messages FOR DELETE USING (true);

CREATE TEMP TABLE test_results (line text);
GRANT INSERT, SELECT ON test_results TO authenticated;

SET LOCAL role = 'authenticated';
SELECT set_config('request.jwt.claim.sub', 'a02694f3-6863-42c2-8530-8ce66ef926e8', true);

INSERT INTO test_results
SELECT 'AUREA leads: ' || lp.name || ' = ' || count(*)
FROM leads l JOIN leads_pipelines lp ON lp.id = l.leads_pipelines_id
GROUP BY lp.name;

INSERT INTO test_results SELECT 'AUREA clients_people visiveis = ' || count(*) FROM clients_people;
INSERT INTO test_results SELECT 'AUREA messages visiveis = ' || count(*) FROM messages;
INSERT INTO test_results
SELECT 'AUREA messages por pipeline do lead: ' || COALESCE(lp.name,'(sem lead/pipeline)') || ' = ' || count(*)
FROM messages m
LEFT JOIN leads l ON l.people_id = m.people_id
LEFT JOIN leads_pipelines lp ON lp.id = l.leads_pipelines_id
GROUP BY lp.name;

RESET role;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL role = 'authenticated';
SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM settings_users WHERE name = 'João Guirunas' LIMIT 1), true);

INSERT INTO test_results SELECT 'JOAO(admin) messages visiveis = ' || count(*) FROM messages;
INSERT INTO test_results SELECT 'JOAO(admin) leads totais = ' || count(*) FROM leads;

RESET role;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT line FROM test_results ORDER BY line;

COMMIT;
