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

-- ── Limites de tempo do site ────────────────────────────────────────────────
--
-- O padrão do Supabase para este papel é `statement_timeout = 2min`. Dois
-- minutos é o tempo de uma consulta de relatório, não o de uma tela: em
-- 2026-08-17 uma consulta ficou presa e o site inteiro pendurou, porque a
-- ligação só volta ao pool quando a consulta acaba — e com dez ligações no
-- pool bastam dez consultas presas para nunca mais nenhuma tela abrir. Quem
-- estava a marcar viu a roda a girar até desistir, e nada nos logs, porque um
-- pedido pendurado não escreve linha nenhuma.
--
-- Estes limites não deixam o site ficar mais rápido; deixam-no **falhar** em
-- vez de pendurar. Uma tela que dá erro em dez segundos recarrega-se; uma que
-- gira para sempre obriga a reiniciar o servidor.
--
-- Vive aqui e não no `postgres.js` de propósito: o papel leva o limite consigo
-- para qualquer ligação, venha ela do site, do pooler ou de um script — e não
-- há como esquecer de o ligar numa opção do cliente.
--
-- Só o `app_web`. Migrations, `db:constraints` e o seed entram como dono
-- (`postgres`) por DIRECT_URL, e esses precisam mesmo de demorar.
ALTER ROLE app_web SET statement_timeout = '10s';
ALTER ROLE app_web SET lock_timeout = '3s';
ALTER ROLE app_web SET idle_in_transaction_session_timeout = '15s';

-- Tabelas e sequences que ainda não existem: nascem com a migration seguinte,
-- criadas pelo papel dono (`postgres`, o mesmo em dev local, na Railway e no
-- Supabase). Sem isto, cada `db:migrate` exigiria voltar aqui e regravar os
-- GRANTs à mão para as tabelas novas.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_web;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_web;
