-- ORA: Setup templates (msg naming) + followups
-- Deletes old d-naming templates, inserts 23 new msg-naming templates with variables_map,
-- and creates 19 followups (16 Em Cadência + 3 Agendado)

BEGIN;

-- ── 1. Delete old ORA d-naming template records ───────────────────────────────
DELETE FROM whatsapp_templates
WHERE meta_template_name IN (
  'ora_rec_d1', 'ora_rec_d1_v2', 'ora_rec_d2', 'ora_rec_d3', 'ora_rec_d4', 'ora_rec_d5',
  'ora_pes_d1', 'ora_pes_d2', 'ora_pes_d3', 'ora_pes_d4', 'ora_pes_d5',
  'ora_evt_d1', 'ora_evt_d2', 'ora_evt_d3', 'ora_evt_d4', 'ora_evt_d5',
  'ora_net_d1', 'ora_net_d2', 'ora_net_d3', 'ora_net_d4', 'ora_net_d5',
  'ora_link_reuniao'
);

-- ── 2. Delete all existing followups (ORA tenant has none, safe to wipe) ──────
DELETE FROM leads_stages_followups;

-- ── 3. Insert 23 new templates ────────────────────────────────────────────────
INSERT INTO whatsapp_templates (id, id_template, name, slug, meta_template_name, system_enabled, json_data) VALUES

-- RECOMENDAÇÃO
(gen_random_uuid(), '1504144024572096', 'Recomendação - Mensagem 1', 'ora_rec_msg1|pt_BR', 'ora_rec_msg1', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1504144024572096","variables_map":{"1":"nome","2":"recomendante","3":"relacao_recomendante"},"components":[{"type":"BODY","text":"Olá {{1}}, sou eu Ora. Tudo Bem!? Estou te ligando a pedido do {{2}}, {{3}}. Tentei contato com você algumas vezes e não tive sucesso. Você está podendo falar um minutinho?"}]}'::jsonb),

(gen_random_uuid(), '1841682129843191', 'Recomendação - Mensagem 2', 'ora_rec_msg2|pt_BR', 'ora_rec_msg2', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1841682129843191","variables_map":{"1":"nome","2":"recomendante"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? O {{2}} te avisou que eu iria entrar em contato? Meu nome é ORA, faço parte do time da Erika Crivellari, ela é especialista em planejamento financeiro e seu amigo o {{2}} fez um trabalho com ela e ficou bastante entusiasmado, ele acredita que seria muito importante você conhecer também. Será em torno de 30 minutinhos online. Pra você seria melhor no horário comercial ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '1569518377851835', 'Recomendação - Mensagem 3', 'ora_rec_msg3|pt_BR', 'ora_rec_msg3', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1569518377851835","variables_map":{"1":"nome","2":"recomendante"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? Como seu amigo, {{2}}, nos pediu para persistir neste encontro porque acredita na importância, e nos disse que seu tempo é valioso, a pedido dele vamos flexibilizar a agenda pra você. Qual melhor horário no horário comercial ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '1800256644740767', 'Recomendação - Mensagem 4', 'ora_rec_msg4|pt_BR', 'ora_rec_msg4', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1800256644740767","variables_map":{"1":"nome","2":"recomendante"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. Como seu amigo, {{2}}, não está pronto para desistir de você, eu também não, resolvi fazer mais uma tentativa. Qual melhor horário para te ligar, manha ou tarde?"}]}'::jsonb),

(gen_random_uuid(), '2176088979794287', 'Recomendação - Mensagem 5', 'ora_rec_msg5|pt_BR', 'ora_rec_msg5', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"2176088979794287","variables_map":{"1":"nome","2":"recomendante"},"components":[{"type":"BODY","text":"Boa tarde {{1}}, Como não obtive um retorno de sua parte, estou encerrando meu contato por hora. Acredito que seu amigo, {{2}}, quando te recomendou para essa oportunidade, realmente pensou o quanto seria importante pra você. Mas entendo o tempo, e o momento de cada um, e fico a disposição caso queira dar sequência. Abraço e ótimo dia."}]}'::jsonb),

-- PESSOAL
(gen_random_uuid(), '1454084202436478', 'Pessoal - Mensagem 1', 'ora_pes_msg1_v2|pt_BR', 'ora_pes_msg1_v2', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1454084202436478","variables_map":{"1":"nome","2":"relacao_erika"},"components":[{"type":"BODY","text":"Olá {{1}}, sou eu Ora. Tudo Bem!? Faço parte da equipe da Erika Crivellari, {{2}}, ela me pediu que eu entrasse em contato com você pessoalmente. Ela gostaria de agendar um momento para conversar sobre negócios. Será por volta de 30 a 40 minutinhos online. É melhor pra você no horário comercial ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '2419512888474524', 'Pessoal - Mensagem 2', 'ora_pes_msg2|pt_BR', 'ora_pes_msg2', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"2419512888474524","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? Erika me pediu para persistir neste encontro porque acredita na importância dessa conversa, e nos disse que seu tempo é valioso, a pedido dela vou flexibilizar a agenda pra você. Qual melhor horário no horário comercial ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '1268723588662881', 'Pessoal - Mensagem 3', 'ora_pes_msg3|pt_BR', 'ora_pes_msg3', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1268723588662881","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. Como sua amiga, Erika, não está pronta para desistir de você eu também não, resolvi fazer mais uma tentativa. Qual melhor horário para essa agenda? Horário comercial ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '1621370405747708', 'Pessoal - Mensagem 4', 'ora_pes_msg4|pt_BR', 'ora_pes_msg4', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1621370405747708","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. Como sua amiga, Erika, não está pronta para desistir de você eu também não, resolvi fazer mais uma tentativa. Qual melhor horário para essa agenda? Horário comercial ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '1762540971775724', 'Pessoal - Mensagem 5', 'ora_pes_msg5|pt_BR', 'ora_pes_msg5', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1762540971775724","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Boa tarde {{1}}, Como não obtive um retorno de sua parte, a pedido da Erika Crivellari, estou encerrando nosso contato por hora. Mas entendemos o tempo, e o momento de cada um, e nos colocamos a disposição caso tenha interesse. Abraço e ótimo dia."}]}'::jsonb),

-- EVENTO
(gen_random_uuid(), '1933453110650472', 'Evento - Mensagem 1', 'ora_evt_msg1|pt_BR', 'ora_evt_msg1', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1933453110650472","variables_map":{"1":"nome","2":"nome_evento"},"components":[{"type":"BODY","text":"Olá {{1}}, sou eu Ora. Tudo Bem!? Faço parte da equipe da Erika Crivellari, e estou entrando em contato pela sua participação no {{2}}. Tentei contato com você algumas vezes e não tive sucesso. Erika gostaria de um encontro com você e me pediu para flexibilizar a agenda dela pra você. Será em torno de 30 minutinhos online. O que fica melhor pra você horário comercial ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '1537514448080707', 'Evento - Mensagem 2', 'ora_evt_msg2|pt_BR', 'ora_evt_msg2', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1537514448080707","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? Vamos agendar esse encontro? O que fica melhor pra você horário comercial ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '2069419773628637', 'Evento - Mensagem 3', 'ora_evt_msg3|pt_BR', 'ora_evt_msg3', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"2069419773628637","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. A Erika está animada para esse encontro e não está pronta para desistir de você. Qual melhor horário para te ligar? Hoje, a tarde ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '1500323665022812', 'Evento - Mensagem 4', 'ora_evt_msg4|pt_BR', 'ora_evt_msg4', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1500323665022812","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. Como não estou pronta para desistir de você, resolvi fazer mais uma tentativa. Qual melhor horário para te ligar? Hoje, a tarde ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '825657183951462', 'Evento - Mensagem 5', 'ora_evt_msg5|pt_BR', 'ora_evt_msg5', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"825657183951462","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Boa tarde {{1}}, Como não obtive um retorno de sua parte, estou encerrando nosso contato por hora. Mas entendemos o tempo, e o momento de cada um, e nos colocamos a disposição caso tenha interesse. Abraço e ótimo dia."}]}'::jsonb),

-- NETWORK
(gen_random_uuid(), '1346440427541214', 'Network - Mensagem 1', 'ora_net_msg1|pt_BR', 'ora_net_msg1', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1346440427541214","variables_map":{"1":"nome","2":"nome_evento"},"components":[{"type":"BODY","text":"Olá {{1}}, sou eu Ora. Tudo Bem!? Faço parte da equipe da Erika Crivellari, vocês se conheceram no {{2}}, ela me pediu que eu entrasse em contato com você pessoalmente. Tentei contato com você algumas vezes e não tive sucesso. Ela pediu que, no seu caso, eu flexibilizasse a agenda dela. Será por volta de 30 a 40 minutinhos! Como funcionam seus horários, é melhor pra você no horário comercial ou a noite? Te aguardo Obrigada"}]}'::jsonb),

(gen_random_uuid(), '2323619684829661', 'Network - Mensagem 2', 'ora_net_msg2|pt_BR', 'ora_net_msg2', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"2323619684829661","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? Vamos agendar esse encontro? O que fica melhor pra você horário comercial ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '955651300392747', 'Network - Mensagem 3', 'ora_net_msg3|pt_BR', 'ora_net_msg3', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"955651300392747","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. A Erika não está pronta para desistir de você eu também não, resolvi fazer mais uma tentativa. Qual melhor horário para te ligar? Hoje, a tarde ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '3917331101894030', 'Network - Mensagem 4', 'ora_net_msg4|pt_BR', 'ora_net_msg4', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"3917331101894030","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Olá {{1}}, Tudo Bem!? Estou tentando contato com você há algum tempo, mas até então não obtive resposta. Como Erika, não está pronta para desistir de você eu também não, resolvi fazer mais uma tentativa. Qual melhor horário para te ligar? Hoje, a tarde ou a noite?"}]}'::jsonb),

(gen_random_uuid(), '1115877250753465', 'Network - Mensagem 5', 'ora_net_msg5|pt_BR', 'ora_net_msg5', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1115877250753465","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Boa tarde {{1}}, Como não obtive um retorno de sua parte, a pedido da Erika Crivellari, estou encerrando nosso contato por hora. Mas entendemos o tempo, e o momento de cada um, e nos colocamos a disposição caso tenha interesse. Abraço e ótimo dia."}]}'::jsonb),

-- AGENDAMENTO
(gen_random_uuid(), '990877199960944', 'Agendamento - Confirmação', 'ora_agend_confirmacao|pt_BR', 'ora_agend_confirmacao', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"990877199960944","variables_map":{"1":"nome","2":"data_reuniao"},"components":[{"type":"BODY","text":"Olá {{1}}, sou eu Ora. Segue a confirmação do encontro de vocês com a Erika Crivellari. Será {{2}}. Te envio o link por aqui no dia combinado. Tenho certeza que será incrível esse café virtual com ela. Ótimo dia!"}]}'::jsonb),

(gen_random_uuid(), '1739178630846873', 'Agendamento - Lembrete', 'ora_agend_lembrete|pt_BR', 'ora_agend_lembrete', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"1739178630846873","variables_map":{"1":"nome"},"components":[{"type":"BODY","text":"Bom dia {{1}}. Tudo bem? Amanhã seu encontro com a Erika Crivellari está confirmado, ela está animada para esta conversa. Antes da reunião você receberá o link da sala. Ótimo dia!"}]}'::jsonb),

(gen_random_uuid(), '948633781376107', 'Agendamento - Link Reunião', 'ora_agend_link|pt_BR', 'ora_agend_link', false,
 '{"category":"UTILITY","language":"pt_BR","meta_template_id":"948633781376107","variables_map":{"1":"nome","2":"link_reuniao"},"components":[{"type":"BODY","text":"Bom dia {{1}}. Segue o link do seu encontro com a Erika Crivellari: {{2}} Até daqui a pouco!"}]}'::jsonb);

-- ── 4. Insert 19 followups ────────────────────────────────────────────────────
-- Em Cadência stage (c8314736-4d07-42e9-9961-5c2e7fb71738): 16 followups (4 origins × D2-D5)
-- Agendado stage (59cc4888-0a23-41e4-a180-2dd349beb30e): 3 universal followups
-- control: 1=recomendacao, 2=pessoal, 3=evento, 4=network, NULL=universal

-- RECOMENDAÇÃO D2 (1 day)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Recomendação - Mensagem 2', 1, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 1
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_rec_msg2';

-- RECOMENDAÇÃO D3 (2 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Recomendação - Mensagem 3', 2, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 1
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_rec_msg3';

-- RECOMENDAÇÃO D4 (3 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Recomendação - Mensagem 4', 3, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 1
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_rec_msg4';

-- RECOMENDAÇÃO D5 (4 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Recomendação - Mensagem 5', 4, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 1
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_rec_msg5';

-- PESSOAL D2 (1 day)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Pessoal - Mensagem 2', 1, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 2
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_pes_msg2';

-- PESSOAL D3 (2 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Pessoal - Mensagem 3', 2, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 2
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_pes_msg3';

-- PESSOAL D4 (3 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Pessoal - Mensagem 4', 3, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 2
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_pes_msg4';

-- PESSOAL D5 (4 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Pessoal - Mensagem 5', 4, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 2
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_pes_msg5';

-- EVENTO D2 (1 day)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Evento - Mensagem 2', 1, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 3
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_evt_msg2';

-- EVENTO D3 (2 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Evento - Mensagem 3', 2, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 3
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_evt_msg3';

-- EVENTO D4 (3 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Evento - Mensagem 4', 3, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 3
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_evt_msg4';

-- EVENTO D5 (4 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Evento - Mensagem 5', 4, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 3
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_evt_msg5';

-- NETWORK D2 (1 day)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Network - Mensagem 2', 1, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 4
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_net_msg2';

-- NETWORK D3 (2 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Network - Mensagem 3', 2, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 4
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_net_msg3';

-- NETWORK D4 (3 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Network - Mensagem 4', 3, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 4
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_net_msg4';

-- NETWORK D5 (4 days)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Network - Mensagem 5', 4, 0, 0, true,
       'c8314736-4d07-42e9-9961-5c2e7fb71738', wt.id, wt.id::text, 4
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_net_msg5';

-- AGENDADO: Confirmação (5 min delay = near-immediate)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Agendamento - Confirmação', 0, 0, 5, true,
       '59cc4888-0a23-41e4-a180-2dd349beb30e', wt.id, wt.id::text, NULL
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_agend_confirmacao';

-- AGENDADO: Lembrete (1 day after scheduling)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Agendamento - Lembrete', 1, 0, 0, true,
       '59cc4888-0a23-41e4-a180-2dd349beb30e', wt.id, wt.id::text, NULL
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_agend_lembrete';

-- AGENDADO: Link Reunião (2 days after scheduling = meeting day)
INSERT INTO leads_stages_followups (type, message, days, hours, minutes, active, leads_stages_id, whatsapp_template_id, template_id, control)
SELECT 'whatsapp', 'Agendamento - Link Reunião', 2, 0, 0, true,
       '59cc4888-0a23-41e4-a180-2dd349beb30e', wt.id, wt.id::text, NULL
FROM whatsapp_templates wt WHERE wt.meta_template_name = 'ora_agend_link';

-- ── 5. Delete Frio and Perdido stages (no leads in those stages) ──────────────
DELETE FROM leads_stages WHERE id IN (
  'bd783151-13ad-45bd-9472-a5e9bb95182f',  -- Frio
  'cb7b88c9-6cf9-41dd-9eb0-b2a033c4cdec'   -- Perdido
);

COMMIT;
