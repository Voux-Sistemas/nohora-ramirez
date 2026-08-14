-- ════════════════════════════════════════════════════════════════════════════
-- Papel `app_web`: o site deixa de conectar como dono do banco
--
-- ADR-009 (docs/DECISOES.md): ao mover o banco para o Supabase ele ganha
-- superfície pública — antes só existia dentro da rede privada da Railway.
-- Compensação: o site passa a autenticar com um papel que só sabe fazer DML
-- (select/insert/update/delete) nas tabelas de hoje e nas que ainda vão
-- nascer, e nunca um DROP TABLE, um GRANT ou um ALTER. Migration e
-- `db:constraints` continuam a rodar como o dono (`postgres`), por DIRECT_URL
-- — é esse papel, não o `app_web`, que precisa de poder criar e alterar.
--
-- Sem senha depois deste script: um papel LOGIN sem senha não autentica por
-- senha, então nasce trancado de propósito. Definir a senha é um passo à
-- parte, feito uma vez, direto no SQL Editor do Supabase — nunca commitada,
-- nunca colada nesta conversa:
--     ALTER ROLE app_web WITH PASSWORD 'escolha uma senha forte aqui';
-- Depois disso, DATABASE_URL do serviço `web` passa a usar
-- `postgres://app_web:<senha>@...` em vez do papel dono.
-- ════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_web') THEN
    CREATE ROLE app_web WITH LOGIN;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_web', current_database());
END
$$;

GRANT USAGE ON SCHEMA public TO app_web;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_web;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_web;

-- Tabelas e sequences que ainda não existem: nascem com a migration seguinte,
-- criadas pelo papel dono (`postgres`, o mesmo em dev local, na Railway e no
-- Supabase). Sem isto, cada `db:migrate` exigiria voltar aqui e regravar os
-- GRANTs à mão para as tabelas novas.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_web;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_web;
