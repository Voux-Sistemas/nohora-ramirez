# Modelo de dados

A fonte da verdade é `packages/db/src/schema/*.ts`. Este documento explica o desenho e o porquê
de cada peça; quando os dois discordarem, quem está certo é o schema.

São **40 tabelas** em Drizzle, mais uma (`deployment_env`) que nasce em SQL à parte. Toda
tabela tem `id` (uuid gerado no banco), e quase todas `created_at` e `updated_at` em
`timestamptz`. Soft delete existe num sítio só — `users.deleted_at` —, e não por descuido:
apagar uma marcação tem de libertar o horário de verdade, portanto a agenda apaga linhas.

Duas convenções valem em todo o lado e poupam surpresas:

- **Todo o valor monetário é inteiro em cêntimos.** Nunca vírgula flutuante, em nenhuma coluna.
- **Toda a data é `timestamptz`, guardada em UTC.** A conversão para hora de parede acontece na
  borda, com o fuso **da unidade** — nunca o do servidor nem o do navegador. O ajudante `tz()`
  em `_shared.ts` existe para que ninguém declare uma coluna de data sem fuso por distração.

O eixo multi-unidade é `unit_id`. Tabela operacional ou o carrega, ou chega a ele por chave
estrangeira num salto.

---

## 1. Mapa das entidades

```
organizations (a rede)
 └── units (duas lojas: Valongo e Maia)
      ├── unit_photos · unit_hours · unit_exceptions
      ├── resources ── resource_blocks
      └── cash_sessions ── cash_movements

resource_types (da rede, não da unidade) ── resources

users ──┬── user_roles (papel por unidade; sem unidade = escopo rede)
        ├── sessions · auth_otps
        ├── staff_profiles ──┬── staff_units · staff_schedules · staff_time_off
        │                    └── staff_skills (n:n com services)
        └── client_profiles ── client_notes

service_categories ── services ──┬── service_pricing (exceção por unidade e/ou profissional)
                                 └── service_resource_requirements (n:n com resource_types)

appointments ──┬── appointment_items ──┬── appointment_staff_blocks
               │                       └── appointment_resource_blocks
               ├── appointment_status_events
               ├── appointment_discounts
               ├── payments
               └── comanda_closures

waitlist_entries · message_templates · notification_logs · audit_logs · consent_records
```

---

## 2. As tabelas que existem

### Organização e unidades — `schema/organization.ts`

**`organizations`** — a rede. `name`, `slug` (único), `document`, `timezone`, `settings` (jsonb).
Uma linha por enquanto.

**`units`** — a loja. `organization_id`, `name`, `slug` (único dentro da organização), `phone`,
`email`, `address_line`, `district`, `city`, `state`, `postal_code`, `latitude`, `longitude`,
`image_url` (a capa), `timezone`, `active`, `settings` (jsonb).

O `settings` da unidade é onde vivem as regras de marcação, e o motor lê de lá: `minLeadMin`,
`maxLeadDays`, `granularityMin`, `cancellationWindowHours`, `interServiceGapMin`,
`depositPolicy`, `noShowPolicy`.

**`unit_photos`** — a galeria da loja. `unit_id`, `url`, `alt`, `sort_order`. É tabela e não um
array dentro de `settings` por um motivo prático: o formulário de unidade reescreve `settings`
inteiro a cada gravação, e uma galeria guardada lá seria apagada em silêncio no dia em que
alguém corrigisse o telefone.

**`unit_hours`** — `unit_id`, `weekday` (0 = domingo … 6 = sábado), `opens_at`, `closes_at`.
Mais de uma linha por dia representa a pausa de almoço.

**`unit_exceptions`** — feriado e horário especial, que se sobrepõem ao `unit_hours`.
`unit_id`, `date`, `closed`, `opens_at`, `closes_at`, `reason`.

**`resource_types`** — cabine, lavatório, secador, maca. `organization_id`, `name`. O **tipo é
da rede**, não da loja: "cabine" é o mesmo conceito nas duas, e se o tipo fosse por unidade o
catálogo de serviços precisaria de uma linha de requisito por loja só para dizer o mesmo duas
vezes.

**`resources`** — a instância física. Duas cabines são duas linhas. `unit_id`,
`resource_type_id`, `name`, `active`, `priority` (ordem de preferência ao alocar).

**`resource_blocks`** — manutenção, obra, equipamento avariado. `resource_id`, `starts_at`,
`ends_at`, `reason`.

### Pessoas — `schema/people.ts`

**`users`** — uma única tabela de pessoas: cliente e equipa partilham-na, e o que as separa é o
papel e o perfil associado. `phone` (E.164, **único** — é o identificador principal e o que
garante cliente única nas duas lojas), `email`, `name`, `avatar_url`, `password_hash` (só a
equipa tem; a cliente entra por código), `status` (`active`/`invited`/`suspended`),
`last_login_at`, `deleted_at`.

**`user_roles`** — `user_id`, `unit_id` (nulo = escopo rede, que é como a dona vê tudo), `role`.
O enum tem seis valores — `client`, `professional`, `receptionist`, `unit_manager`, `finance`,
`owner` —, mas só quatro degraus abrem porta hoje. `receptionist` e `finance` existem no enum e
**não dão acesso a nada**: reconhecê-los por engano daria gestão a quem ninguém decidiu dar.
Quem manda nisso é `apps/web/src/server/auth/permissoes.ts`, não o banco.

**`auth_otps`** — códigos de uso único mandados por e-mail. `phone`, `purpose`
(`login` para a área da cliente, `recovery` para a palavra-passe da equipa), `code_hash`, `expires_at`,
`consumed_at`, `attempts`, `request_ip`. O `purpose` separa dois pedidos que chegam pelo mesmo
telefone: sem ele, um código pedido para recuperar a palavra-passe também abriria uma sessão pela porta
do login.

**`sessions`** — `user_id`, `token_hash` (único), `expires_at`, `user_agent`, `ip`, `revoked_at`.

**`staff_profiles`** — `user_id` (único), `display_name`, `color` (a cor da coluna na
agenda e do avatar), `accepts_online_booking`, `hired_at`, `active`. Há também um `bio`, que
o formulário deixou de escrever (ADR-014) porque não havia ecrã nenhum a mostrá-lo.

**`staff_units`** — n:n. `staff_id`, `unit_id`, `is_primary`. É esta tabela — e não
`user_roles` — que decide onde a profissional atende, porque é a mesma que monta as colunas da
agenda.

**`staff_schedules`** — a escala recorrente, com vigência. `staff_id`, `unit_id`, `weekday`,
`starts_at`, `ends_at`, `valid_from`, `valid_to`. Trocar escala é fechar a vigência antiga e
abrir uma nova, nunca editar a linha existente — senão o passado da agenda muda junto.

**`staff_time_off`** — folga, férias, almoço, formação, baixa e bloqueio avulso. `staff_id`,
`unit_id`, `type`, `starts_at`, `ends_at`, `note`, `created_by`. Quem escreve é a secção
*Ausências* da ficha do profissional, e escreve só dois dos seis tipos: `day_off` para o dia
inteiro, `block` para um pedaço dele (ADR-015). O `unit_id` fica sempre nulo — a ausência vale na
rede toda, e é assim que o motor a lê.

**`client_profiles`** — `user_id` (único), `birthdate`, `document`, `how_found_us`,
`preferred_unit_id`, `preferred_staff_id`, `tags` (text[]), `preferences` (jsonb: bebida,
alergia, observação de atendimento), `no_show_count`, `requires_deposit`, `first_visit_at`,
`last_visit_at`.

**`client_notes`** — observação interna, nunca visível à cliente. `client_id`, `author_id`,
`body`, `pinned`.

### Catálogo — `schema/catalog.ts`

**`service_categories`** — `organization_id`, `name`, `note`, `sort_order`, `active`. O `note` é
a ressalva comercial do preçário — "cabelos com extensões sob avaliação", "nail art acresce 5 €".
No papel vive num asterisco ao pé do bloco, e é o que impede a cliente de chegar ao balcão com
um preço na cabeça e outro na conta.

**`services`** — o catálogo é da rede. `organization_id`, `category_id`, `name`, `description`,
`image_url`, `base_price`, `setup_min`, `processing_min`, `finish_min`, `buffer_before_min`,
`buffer_after_min`, `online_bookable`, `requires_deposit`, `deposit_type` (`percent` guarda
pontos-base: 5000 = 50 %; `fixed` guarda cêntimos), `deposit_value`, `sort_order`, `active`.

> `requires_assessment` e `requires_anamnesis` continuam nas colunas e **não são lidas por
> ninguém**. A reunião com os sócios mandou tirar as regras da ficha de serviço, e sem
> interruptor no formulário a primeira era um serviço a desaparecer da montra sem explicação e
> a segunda nunca chegou a fazer nada. Quem precisa de ver a cliente antes de marcar desliga o
> `online_bookable`. As colunas ficam até haver migração que as largue — largar coluna é DDL em
> produção, e vai com a que larga as tabelas de comissão.

> As três colunas de duração são herança do motor de agenda, que sabe libertar a profissional a
> meio do atendimento. **O produto não oferece isso:** a ficha de serviço tem um campo de duração só,
> que vai inteiro para `setup_min` com `processing_min` e `finish_min` a zero. Duração total =
> setup + buffers, e profissional e recurso ficam ocupados do início ao fim.

**`service_pricing`** — a exceção de preço e de duração. `service_id`, `unit_id` (nulo),
`staff_id` (nulo), `price`, `duration_override_min` (sobrescreve a duração **total**).
Precedência, do mais específico ao mais genérico: staff+unit → staff → unit → base. Quem resolve
é `resolvePrice` em `@studio/core`, não o banco.

**`staff_skills`** — a matriz de habilidades. `staff_id`, `service_id`, `enabled`.

**`service_resource_requirements`** — o que o serviço consome. `service_id`, `resource_type_id`,
`quantity`.

### Agendamento — `schema/scheduling.ts`

**`appointments`** — a visita, envelope de um ou mais serviços. `unit_id`, `client_id`,
`starts_at`/`ends_at` (do primeiro ao último item), `status`, `source`, `client_note`,
`internal_note`, `total_price` (congelado no ato), `deposit_required`, `deposit_paid_at`,
`checked_in_at`, `started_at`, `completed_at`, `cancelled_at`, `cancellation_reason`,
`cancelled_by`, `rescheduled_from_id`, `created_by`.

`status`: `draft` · `scheduled` · `confirmed` · `checked_in` · `in_progress` · `completed` ·
`cancelled_by_client` · `cancelled_by_studio` · `no_show`

`source`: `client_app` · `reception` · `whatsapp` · `phone` · `walk_in` · `recurrence`

O schema exporta ainda `LIVE_APPOINTMENT_STATUSES` — os estados em que o horário ainda está
reservado de facto. É a lista que o painel e a pauta do dia usam para não contar como marcação
o que já foi cancelado.

**`appointment_items`** — um por serviço da visita. `appointment_id`, `service_id`, `staff_id`,
`starts_at`, `ends_at`, `price`, `duration_min`, `duration_profile` (jsonb com
`{ setupMin, processingMin, finishMin }`), `sort_order`. `price` e `duration_min` ficam
**congelados**: mexer na tabela de preços nunca pode reescrever o passado.

**`appointment_staff_blocks`** — a reserva efectiva da profissional, buffers incluídos.
`appointment_item_id`, `staff_id`, `block` (`tstzrange`). Um item gera dois blocos quando o
serviço tem processamento, e é o intervalo entre eles que ficaria livre — capacidade que o
produto não usa. **Cancelar uma marcação apaga estas linhas:** bloco existente é horário
ocupado, e é essa a definição.

**`appointment_resource_blocks`** — o mesmo para o recurso físico, que fica preso o serviço
inteiro. `appointment_item_id`, `resource_id`, `block` (`tstzrange`).

**`appointment_status_events`** — o rasto de estado. `appointment_id`, `from_status`,
`to_status`, `actor_id`, `reason`, `occurred_at`.

**`waitlist_entries`** — a fila para horário cheio. `unit_id`, `client_id`, `service_id`,
`staff_id`, `desired_from`, `desired_to`, `status` (`waiting`/`offered`/`booked`/`expired`/
`cancelled`), `offered_at`, `offer_expires_at`. **A tabela existe e nenhum ecrã a escreve:** não
há hoje quem ofereça a vaga quando alguém cancela.

### Comanda e caixa — `schema/finance.ts`

**Não há tabela de comanda.** A comanda **é** a marcação: os itens já estão em
`appointment_items` com profissional e preço congelados, e tudo o que o fecho acrescenta
pendura-se directamente nela — desconto, pagamento e fecho, uma tabela cada. Uma
tabela de comanda separada seria uma segunda cópia dos mesmos itens, com o dobro das
oportunidades de divergir do que a agenda diz.

**`payments`** — `appointment_id`, `cash_session_id`, `method`, `amount`, `received_by`,
`paid_at`. Uma linha por método, porque uma visita pode ser paga em parte em cartão e em parte
em dinheiro. `payment_method`: `cash` · `debit_card` · `credit_card` · `pix` · `other` — o `pix`
é herança do desenho brasileiro e não serve a Portugal (ADR-010).

**`cash_sessions`** — abertura e fecho por unidade. `unit_id`, `status` (`open`/`closed`),
`opening_amount`, `closing_counted_amount` (contado fisicamente), `expected_amount` (abertura +
pagamentos em dinheiro + reforços − sangrias), `difference` (contado − esperado: positivo é
sobra, negativo é falta), `opened_by`, `closed_by`, `opened_at`, `closed_at`, `note`.

**`cash_movements`** — `cash_session_id`, `type` (`payment`/`reinforcement`/`withdrawal`),
`amount`, `note`, `created_by`, `occurred_at`. O `payment` nasce sozinho ao fechar uma comanda
em dinheiro; os outros dois são lançamentos avulsos do balcão.

**`appointment_discounts`** — o desconto aplicado no fecho, **um por marcação** (`appointment_id`
é único). `amount`, `reason`, `applied_by`. Não mexe no preço congelado do item.

**`comanda_closures`** — a comanda fechada, também uma por marcação. `appointment_id` (único),
`closed_by`, `closed_at`. Trava novos pagamentos e descontos. Uma vez fechada não reabre:
para corrigir faz-se um lançamento de ajuste.

### Comunicação — `schema/messaging.ts`

**`message_templates`** — `organization_id`, `key`, `channel`, `category`, `language`, `body`,
`variables` (text[]), `provider_template_id`, `approved`, `active`. Existe para o dia em que o
WhatsApp oficial entrar; **nenhum ecrã a lê hoje.** Os textos que a receção manda estão em
código, em `apps/web/src/server/notifications/templates.ts`.

**`notification_logs`** — o registo do que sai. `user_id`, `channel`, `template_key`, `ref_type`,
`ref_id`, `destination`, `payload`, `status`, `provider_message_id`, `provider_response`,
`cost_cents`, `scheduled_for`, `sent_at`, `failed_at`, `error`.

Esta é usada, e de uma forma que vale explicar: **não existe agendador de avisos.** A fila do
ecrã `/avisos` é uma consulta — "quem atende amanhã e ainda não tem registo de lembrete" —, e o
que impede o aviso duplicado é a própria linha em `notification_logs`. Enviar é gravar; gravar é
sair da fila. Sem worker e sem estado a dessincronizar.

### Plataforma — `schema/platform.ts`

**`audit_logs`** — `actor_id`, `action`, `entity_type`, `entity_id`, `before` (jsonb),
`after` (jsonb), `ip`, `user_agent`, `occurred_at`. **A tabela está de pé e ninguém escreve
nela.** Continua a ser o desenho certo para responder "quem mudou este horário?", mas hoje a
resposta não existe fora de `appointment_status_events`.

**`consent_records`** — consentimento versionado, para o RGPD. `user_id`, `purpose`
(`image_use`/`marketing`/`data_processing`/`health_data`), `granted` (`yes`/`no`),
`text_version`, `granted_at`, `revoked_at`, `ip`. Também sem escrita: existe porque anamnese e
fotografia antes/depois são dado pessoal sensível e sem consentimento registado não se usam — e
essas duas funcionalidades ainda não foram construídas.

### Fora do Drizzle

**`deployment_env`** — criada em `packages/db/sql/02_ambiente.sql`, com uma linha só
(`singleton` boolean como chave primária), `kind` (`producao`/`teste`) e `marked_at`.

Vive fora do schema TypeScript de propósito. O seed começa com um `truncate` em tudo, e uma
variável de ambiente não protege disso — quem corre o script da própria máquina não tem
`NODE_ENV=production` ligado. Por isso a marca fica **dentro** do banco e viaja com ele: o seed
lê esta tabela antes de qualquer escrita e recusa-se a correr quando encontra `producao`.

---

## 3. Regras de integridade que valem código

1. **Overbooking é problema do banco, não da aplicação.** Entre "consultei e estava livre" e
   "gravei" existe uma janela, e sob concorrência ela é atingida. As travas são duas
   constraints `EXCLUDE USING gist` em `packages/db/sql/01_exclusion_constraints.sql` —
   `appointment_staff_blocks_no_overlap` (`staff_id WITH =, block WITH &&`) e
   `appointment_resource_blocks_no_overlap` (`resource_id WITH =, block WITH &&`) —, mais um
   `CHECK (NOT isempty(block))` em cada tabela. Quando rebenta, a aplicação devolve "esse
   horário acabou de ser preenchido" e reapresenta as opções.
2. **A trava precisa do `btree_gist` alcançável.** Num Postgres gerido as extensões moram num
   schema à parte, fora do `search_path` — daí o `SET search_path = public, extensions` no
   topo do ficheiro. O modo de falha mau não é o comando dar erro: é a constraint não nascer e
   o deploy seguir verde. Por isso `apply-constraints.ts` **confere as duas pelo nome** em
   `pg_constraint` depois de aplicar, e falha o deploy se faltar alguma.
3. **Fuso horário** — tudo em `timestamptz` (UTC), convertido na borda com o fuso **da unidade**.
4. **Preço congelado** — `appointment_items.price` e `appointment_items.duration_min` guardam o
   valor do momento do evento. Mudar a tabela de preços não reescreve o passado.
5. **Cliente é única na rede** — `users.phone` é a chave, e o histórico atravessa as duas lojas.
6. **Cancelar apaga bloco.** A definição de "horário ocupado" é "existe linha de bloco", então
   cancelar uma marcação apaga as linhas de `appointment_staff_blocks` e
   `appointment_resource_blocks` em cascata. Não há estado "bloco cancelado" a filtrar em todas as
   consultas, e é por isso que a constraint de exclusão pode ser incondicional.
7. **O site não escreve DDL.** Em produção o `web` liga-se como `app_web`, um papel só com
   `SELECT/INSERT/UPDATE/DELETE` (ADR-009 e `packages/db/sql/03_app_web_role.sql`). Migration,
   constraints e seed passam pelo papel dono, por `DIRECT_URL`.

---

## 4. O que este modelo ainda não tem

Registado aqui porque a ausência é informação: quem procurar estas tabelas não as vai encontrar,
e não é por estarem noutro ficheiro.

**Não existe** comissão — saiu do produto por decisão da dona (ADR-013). **Não existe** stock
(produto, saldo por unidade, movimento, transferência entre lojas, ficha
de consumo por serviço), **não existe** pacote de sessões nem fidelidade ou cupão, **não
existe** anamnese nem galeria antes/depois, **não existe** conversa nem mensagem — o chat não foi
construído, e o que há é o clique para o WhatsApp do próprio salão —, **não existe** avaliação
pós-atendimento, **não existe** recorrência de marcação e **não existe** tabela de fornecedor,
conta a pagar ou receber.

Nada disto foi descartado; simplesmente não está construído. O que estiver decidido em contrário
está em [DECISOES.md](DECISOES.md), e o estado de cada frente em [ROADMAP.md](ROADMAP.md).
