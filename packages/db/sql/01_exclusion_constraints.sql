-- ════════════════════════════════════════════════════════════════════════════
-- Trava anti-overbooking
--
-- Esta é a única garantia real contra dois clientes marcarem o mesmo horário.
-- Checagem na aplicação não resolve: entre "consultei e estava livre" e
-- "gravei" existe uma janela, e sob concorrência ela é atingida.
--
-- Aplicar SEMPRE depois de `npm run db:migrate`:
--     npm run db:constraints --workspace=@studio/db
-- ════════════════════════════════════════════════════════════════════════════

-- Onde procurar o `btree_gist`.
--
-- Num Postgres instalado por nós a extensão cai no `public` e isto não faz
-- diferença. Num Postgres gerenciado — Supabase é o caso — as extensões moram
-- num schema `extensions` à parte, fora do search_path padrão.
--
-- A diferença importa porque o `EXCLUDE USING gist (staff_id WITH =, ...)`
-- logo abaixo precisa da classe de operadores que o btree_gist dá ao `=` de
-- uuid dentro de um índice GiST. Sem achá-la, ou o comando falha, ou — pior —
-- a constraint não nasce e ninguém repara: o salão volta a poder marcar duas
-- clientes na mesma cadeira, no mesmo horário, sem nada reclamar.
--
-- Schema inexistente no search_path é ignorado sem erro, então a linha é
-- inofensiva onde `extensions` não existe.
SET search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ─── profissional ───────────────────────────────────────────────────────────
-- Um serviço com processamento gera DOIS blocos para o mesmo profissional.
-- O intervalo entre eles fica livre de propósito: é o gap booking.

ALTER TABLE appointment_staff_blocks
  DROP CONSTRAINT IF EXISTS appointment_staff_blocks_not_empty;
ALTER TABLE appointment_staff_blocks
  ADD CONSTRAINT appointment_staff_blocks_not_empty
  CHECK (NOT isempty(block));

ALTER TABLE appointment_staff_blocks
  DROP CONSTRAINT IF EXISTS appointment_staff_blocks_no_overlap;
ALTER TABLE appointment_staff_blocks
  ADD CONSTRAINT appointment_staff_blocks_no_overlap
  EXCLUDE USING gist (staff_id WITH =, block WITH &&);

-- ─── recurso físico ─────────────────────────────────────────────────────────
-- Cabine, lavatório e equipamento ficam presos o serviço inteiro, inclusive
-- durante o processamento — o cliente continua ocupando a cadeira.

ALTER TABLE appointment_resource_blocks
  DROP CONSTRAINT IF EXISTS appointment_resource_blocks_not_empty;
ALTER TABLE appointment_resource_blocks
  ADD CONSTRAINT appointment_resource_blocks_not_empty
  CHECK (NOT isempty(block));

ALTER TABLE appointment_resource_blocks
  DROP CONSTRAINT IF EXISTS appointment_resource_blocks_no_overlap;
ALTER TABLE appointment_resource_blocks
  ADD CONSTRAINT appointment_resource_blocks_no_overlap
  EXCLUDE USING gist (resource_id WITH =, block WITH &&);

-- ─── coerência de horário ───────────────────────────────────────────────────

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_end_after_start;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_end_after_start CHECK (ends_at > starts_at);

ALTER TABLE appointment_items
  DROP CONSTRAINT IF EXISTS appointment_items_end_after_start;
ALTER TABLE appointment_items
  ADD CONSTRAINT appointment_items_end_after_start CHECK (ends_at > starts_at);

ALTER TABLE unit_hours
  DROP CONSTRAINT IF EXISTS unit_hours_close_after_open;
ALTER TABLE unit_hours
  ADD CONSTRAINT unit_hours_close_after_open CHECK (closes_at > opens_at);

ALTER TABLE unit_hours
  DROP CONSTRAINT IF EXISTS unit_hours_weekday_range;
ALTER TABLE unit_hours
  ADD CONSTRAINT unit_hours_weekday_range CHECK (weekday BETWEEN 0 AND 6);

ALTER TABLE staff_schedules
  DROP CONSTRAINT IF EXISTS staff_schedules_end_after_start;
ALTER TABLE staff_schedules
  ADD CONSTRAINT staff_schedules_end_after_start CHECK (ends_at > starts_at);

ALTER TABLE staff_schedules
  DROP CONSTRAINT IF EXISTS staff_schedules_weekday_range;
ALTER TABLE staff_schedules
  ADD CONSTRAINT staff_schedules_weekday_range CHECK (weekday BETWEEN 0 AND 6);

ALTER TABLE staff_time_off
  DROP CONSTRAINT IF EXISTS staff_time_off_end_after_start;
ALTER TABLE staff_time_off
  ADD CONSTRAINT staff_time_off_end_after_start CHECK (ends_at > starts_at);

-- ─── dinheiro e duração ─────────────────────────────────────────────────────
-- Valores em centavos, sempre inteiros e nunca negativos.

ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_price_non_negative;
ALTER TABLE services
  ADD CONSTRAINT services_price_non_negative CHECK (base_price >= 0);

ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_duration_positive;
ALTER TABLE services
  ADD CONSTRAINT services_duration_positive
  CHECK (setup_min + processing_min + finish_min > 0
         AND setup_min >= 0 AND processing_min >= 0 AND finish_min >= 0
         AND buffer_before_min >= 0 AND buffer_after_min >= 0);

ALTER TABLE service_pricing
  DROP CONSTRAINT IF EXISTS service_pricing_price_non_negative;
ALTER TABLE service_pricing
  ADD CONSTRAINT service_pricing_price_non_negative CHECK (price >= 0);

-- Exceção de preço precisa mirar em alguma coisa: unidade, profissional ou os dois.
ALTER TABLE service_pricing
  DROP CONSTRAINT IF EXISTS service_pricing_has_target;
ALTER TABLE service_pricing
  ADD CONSTRAINT service_pricing_has_target
  CHECK (unit_id IS NOT NULL OR staff_id IS NOT NULL);

-- ─── unicidade com coluna anulável ──────────────────────────────────────────
-- Por padrão o Postgres trata NULL como sempre distinto, o que deixaria passar
-- duas exceções de preço para o mesmo (serviço, profissional) sem unidade — e
-- dois papéis iguais de escopo rede para o mesmo usuário. NULLS NOT DISTINCT
-- (Postgres 15+) corrige isso.

DROP INDEX IF EXISTS service_pricing_uq;
CREATE UNIQUE INDEX service_pricing_uq
  ON service_pricing (service_id, unit_id, staff_id) NULLS NOT DISTINCT;

DROP INDEX IF EXISTS user_roles_user_unit_role_uq;
CREATE UNIQUE INDEX user_roles_user_unit_role_uq
  ON user_roles (user_id, unit_id, role) NULLS NOT DISTINCT;

-- ─── um caixa aberto por loja ───────────────────────────────────────────────
-- `openSession` consulta se já há caixa aberto e só depois insere. Entre as
-- duas coisas existe uma janela, e ao balcão ela é atingida de verdade: dois
-- toques em "Abrir caixa" enquanto a página ainda está a carregar, ou a
-- rececionista e a gerente a abrirem o dia ao mesmo tempo em dois ecrãs.
--
-- O estrago não aparece logo. Nascem duas sessões abertas na mesma loja, os
-- pagamentos em dinheiro do dia caem numa ou noutra conforme a que o Postgres
-- devolver primeiro, e à noite o fecho confere metade da gaveta contra o total
-- inteiro — uma falta enorme que ninguém consegue explicar. A outra sessão
-- fica aberta para sempre, porque a tela só mostra uma.
--
-- Índice parcial: a unicidade só vale enquanto o caixa está aberto, senão a
-- loja não podia ter dois dias de histórico.
DROP INDEX IF EXISTS cash_sessions_um_aberto_por_unidade;
CREATE UNIQUE INDEX cash_sessions_um_aberto_por_unidade
  ON cash_sessions (unit_id) WHERE status = 'open';
