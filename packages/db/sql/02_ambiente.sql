-- ════════════════════════════════════════════════════════════════════════════
-- Marca de ambiente
--
-- O seed (`npm run db:seed`) começa com um `truncate` em todas as tabelas do
-- schema public. Rodá-lo apontado para o banco do salão apaga a agenda, o
-- cadastro das clientes e o histórico — sem confirmação e sem volta.
--
-- Variável de ambiente não protege disso: quem roda o script da própria
-- máquina não tem `NODE_ENV=production` ligado. Por isso a marca fica DENTRO
-- do banco, e viaja com ele. O seed lê esta tabela antes de qualquer escrita e
-- se recusa a rodar quando encontra 'producao'.
--
-- Marcar um banco como produção (uma vez, no dia que ele nasce):
--     insert into deployment_env (kind) values ('producao')
--       on conflict (singleton) do update set kind = 'producao';
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS deployment_env (
  singleton  boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  kind       text NOT NULL CHECK (kind IN ('producao', 'teste')),
  marked_at  timestamptz NOT NULL DEFAULT now()
);
