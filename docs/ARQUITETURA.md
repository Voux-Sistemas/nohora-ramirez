# Arquitetura técnica

O que está montado, e por que está montado assim. Onde uma escolha tem data e motivo, o registo
completo é [DECISOES.md](DECISOES.md); aqui ficam só o suficiente para perceber o desenho.

---

## 1. A stack, tal como está instalada

| Camada | Escolha | Por quê |
|---|---|---|
| App web | **Next.js 15 (App Router) + React 19 + TypeScript** | Um codebase serve a vitrine, a área da cliente e a operação. Server Components e server actions cortam a camada de API que não precisamos de ter |
| Estilo | **Tailwind CSS 4** (via `@tailwindcss/postcss`) | Tokens e tema vivem em `globals.css`; o sistema visual está em [DESIGN.md](../DESIGN.md) |
| Componentes | escritos aqui, em `components/ui` | Não há biblioteca de componentes instalada. `class-variance-authority`, `clsx` e `tailwind-merge` são as três dependências que fazem as variantes; `lucide-react` dá os ícones |
| Banco | **PostgreSQL 17**, no Supabase (Frankfurt) | `tstzrange` + `btree_gist` para a trava anti-overbooking. Não é opcional — ver §3 |
| ORM | **Drizzle ORM** (ADR-006) | SQL-first e tipado, e não estorva quando é preciso descer ao SQL |
| Validação | **Zod** | Entrada de server action e de formulário |
| Autenticação | equipa: telefone + palavra-passe (`scrypt`) · cliente: telefone + código de 6 dígitos por e-mail | Escrita à mão em `server/auth/`. Sessão em cookie, `sessions.token_hash` no banco |
| E-mail | **Resend**, por `fetch` directo | Sem SDK e sem dependência nova: é um POST. Ver §5 |
| Imagens | **Bucket da Railway** (S3-compatível), bucket `imagens` | Assinatura SigV4 escrita em `packages/core/src/s3/`. O driver é trocável por `IMAGE_STORE` |
| Testes | **Vitest** | 127 testes, quase todos em `packages/core` |
| Deploy | **Railway** (Amesterdão), push na branch `producao` | ADR-009 |

**O que não está instalado, e é bom não presumir:** não há biblioteca de componentes de
terceiros, não há fila de jobs (nem `pg-boss` nem outra), não há servidor de WebSocket, não há
gateway de pagamento (ADR-010), não há WhatsApp Cloud API e não há Sentry. Nada disto está
descartado — está por construir, e o estado de cada frente está em [ROADMAP.md](ROADMAP.md).

### A infra está decidida (ADR-009)

O banco é um projeto Supabase em Frankfurt, usado **como Postgres gerido e não como
plataforma**: sem RLS, sem Supabase Auth, sem `supabase-js`. As permissões continuam em
TypeScript, em `server/auth/permissoes.ts`, testáveis fora do banco. O site Next.js corre no
Railway, em Amesterdão, e o deploy é por push na branch `producao`.

Duas URLs, não uma, e as duas no pooler de sessão (5432): `DATABASE_URL` é por onde o site lê
e escreve, como o papel `app_web`, que só sabe fazer DML; `DIRECT_URL` liga-se como o papel
dono, e só migration, constraints e seed passam por lá. Diferem no papel, não na porta — e essa
metade não se vê ao olhar para a string. O pooler de transação (6543) está fora de questão para
o site: ele engole as consultas que viajam encavalitadas e deixou a página de agendamento sem
responder de todo. O motivo medido de cada escolha está em `packages/db/src/index.ts` e no
`.env.example`.

---

## 2. A estrutura, tal como existe

```
apps/
└── web/                        Next.js — a aplicação inteira
    └── src/
        ├── app/                rotas (ver o mapa abaixo)
        ├── components/         admin, agenda, auth, booking, brand, clientes,
        │                       clients, notifications, operate, tema, ui, vitrine
        ├── lib/                pais, formatação, tema, ambiente, cliente de banco
        └── server/             admin, auth, finance, notifications, people,
                                scheduling, security, storage
packages/
├── core/                       domínio puro: availability, pricing, time, csv,
│                               security, s3. Sem Next, sem ORM
└── db/                         schema Drizzle, migrations, sql/, seed, cadastro
ops/                            backup diário e prova de restauro, onboarding
dados/                          os CSV que definem o formato de importação
material/                       o que a dona mandou: fotografias, logo, preçário
docs/
```

São **três workspaces npm** (ADR-005), não mais. Não existe `apps/worker`, não existe
`apps/realtime`, não existe `packages/integrations` nem `packages/ui` — o worker e o realtime
porque não há nada assíncrono a correr, os outros dois porque a aplicação é uma só e não há
segundo consumidor para justificar a fronteira.

**Regra de ouro (ADR-007):** `packages/core` não importa Next, não importa Drizzle e não sabe o
que é HTTP. Regra de negócio pura, com teste unitário. É o que garante que o cálculo de
preço e o motor de disponibilidade sejam de confiança — e é por isso que a esmagadora maioria
dos testes vive lá.

### As rotas

Duas áreas, e a divisão importa porque as cenas de uso não se parecem.

**A vitrine e a cliente**, tudo público — `/loja` e `/loja/[unidade]` (a montra),
`/agendar` → `/agendar/[unidade]` → `/horarios` → `/confirmar` → `/pronto/[id]` (marcar sem
conta nenhuma), e `/conta` com `/conta/entrar` e `/conta/verificar` para ver e cancelar.

**A operação**, tudo atrás de sessão — `/` é a pauta do dia das lojas; `/agenda` e
`/agenda/[unidade]` com `/comanda/[id]`, `/encaixe` e `/remarcar/[id]`; `/caixa` e
`/caixa/[unidade]`; `/avisos` e `/avisos/[unidade]`; `/clientes` com `/[id]`, `/novo` e
`/importar`; e a área da dona em `/admin` — `/unidades`, `/servicos` e `/equipe`. As três
secções por loja existem duas vezes de propósito: sem loja no endereço são a vista das lojas
todas, e é para lá que aponta o "Todas" do seletor da barra (ADR-016). O
acesso é por palavra-passe em `/entrar`, com `/esqueci` e `/nova-senha`, e
a primeira conta de todas nasce em `/comecar` (ver `ops/README.md`).

**As três rotas de API** são `/api/imagens/[...key]` (serve a fotografia a partir do bucket, e é
a nossa rota que decide o `Content-Type`), `/api/saude` e `/api/dev/smoke`. Não há webhook
nenhum, porque não há nada do lado de fora a chamar-nos.

---

## 3. Motor de disponibilidade

O componente mais crítico, e o único que tem suíte de testes a sério. Vive em
`packages/core/src/availability/`, e a aplicação chega-lhe por
`apps/web/src/server/scheduling/availability.ts`, que é fina de propósito: monta o contexto,
chama o motor e devolve o resultado com preço resolvido. Nenhuma regra de agenda vive na
aplicação.

O que o motor exporta: `findAvailableSlots` (varre a grade e devolve as opções),
`planVisitAt` (valida um instante específico — é o que a confirmação usa, porque a cliente manda
só a hora e é o servidor que replaneia quem faz o quê e em que recurso), `cartDurationMin` e
`serviceClientDurationMin`.

### Algoritmo

```
1. CARREGAR CONTEXTO (uma consulta por tipo, nunca N+1)
   - unit_hours + unit_exceptions do período
   - staff elegíveis = staff_units ∩ staff_skills(serviço) ∩ accepts_online_booking
   - staff_schedules + staff_time_off do período
   - blocos activos do período (por profissional e por recurso)
   - resources da unidade por resource_type exigido
   - service_pricing resolvido (preço + duração por profissional)

2. MONTAR JANELAS LIVRES
   por profissional: (escala ∩ horário da unidade) − ausências − ocupações
   por recurso:      horário da unidade − ocupações

3. VARRER A GRADE
   para cada instante na granularidade da unidade:
     encaixar o carrinho em sequência, serviço a serviço,
     escolhendo profissional (o pedido, ou o melhor entre os elegíveis),
     prendendo o recurso do início ao fim e aplicando os buffers

4. FILTRAR POR REGRAS
   antecedência mínima e máxima, unidade fechada, feriado

5. DISTRIBUIR
   Em "sem preferência", a estratégia `balanced` equilibra a carga do dia.
```

Uma nota de eficiência de que o ecrã de horários depende: `findSlots` varre um contexto **já
carregado**. O ecrã mostra catorze dias de uma vez, e carregar o contexto uma vez e varrer sai
muito mais barato do que uma consulta por dia.

### Gap booking — capacidade do motor, desligada no produto

O motor sabe libertar a profissional durante o `processing` e devolver esse pedaço à grade dela,
sabe aplicar folga antes e depois, e sabe prender um recurso físico junto com a pessoa.
**O produto não expõe nada disso.** A ficha de serviço tem um campo de duração só, gravado
inteiro em `setup_min` com o resto a zero, portanto todo o bloco é contínuo; `buffer_before_min`
e `buffer_after_min` ficam em zero; e `service_resource_requirements` deixou de ter quem lhe
escreva quando `/admin/recursos` saiu (ADR-014). O código continua no sítio, testado, porque é
o mesmo caminho que monta o bloco da agenda — ligar qualquer um deles outra vez é repor o campo
no formulário, não reescrever o motor.

### Concorrência

A trava não está em `appointment_items` — está nas duas tabelas de bloco, que são o registo do
que está de facto ocupado:

```sql
SET search_path = public, extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointment_staff_blocks
  ADD CONSTRAINT appointment_staff_blocks_no_overlap
  EXCLUDE USING gist (staff_id WITH =, block WITH &&);

ALTER TABLE appointment_resource_blocks
  ADD CONSTRAINT appointment_resource_blocks_no_overlap
  EXCLUDE USING gist (resource_id WITH =, block WITH &&);
```

Não há cláusula `WHERE` a filtrar estado, e isso é deliberado: cancelar uma marcação **apaga**
as linhas de bloco, portanto bloco existente é horário ocupado, ponto. A criação corre numa
transação; se a constraint rebentar, o ecrã devolve "esse horário acabou de ser preenchido" e
reapresenta as opções.

O ficheiro é `packages/db/sql/01_exclusion_constraints.sql`, aplicado por
`npm run db:constraints` — que corre a seguir a `db:migrate`, é idempotente, e **confere as duas
constraints pelo nome depois de aplicar**. O modo de falha mau não é o comando dar erro: é a
constraint não nascer, por o `btree_gist` não estar no `search_path` de um Postgres gerido, e o
deploy seguir verde com o salão a marcar duas clientes na mesma cadeira.

---

## 4. Autenticação e permissões

Escrita à mão, sem biblioteca. A palavra-passe da equipa é `scrypt` no formato `salt:hash`
(`server/auth/crypto.ts`); a sessão é um cookie cujo `token_hash` está em `sessions`.

A cliente não tem palavra-passe: entra com o telefone e recebe um código de seis dígitos por e-mail.
`auth_otps.purpose` separa o pedido de login do pedido de recuperação de palavra-passe da equipa —
sem essa coluna, um código pedido para trocar a palavra-passe também abriria sessão pela porta do login.

Quatro degraus, e quem decide é `server/auth/permissoes.ts`: suporte (que **não mora no banco** —
vem da variável `TELEFONES_SUPORTE`, e eleva sem autenticar), dona, gerente e profissional. O
alcance da profissional lê-se de `staff_units`, não de `user_roles`, porque é a mesma tabela que
monta as colunas da agenda. Os papéis `receptionist` e `finance` existem no enum e não abrem
porta nenhuma. A tabela completa e o raciocínio estão em [ops/README.md](../ops/README.md).

As ações de operação descobrem a unidade **lendo a linha do banco**, nunca um campo escondido do
formulário — é o que impede um id trocado de virar um lançamento no caixa da loja vizinha.

---

## 5. Notificações

Duas coisas diferentes, e é útil não as confundir.

**O e-mail é o único envio automático do sistema.** Existe para o que não pode depender de
alguém clicar: o código de acesso da cliente, que tem de sair às onze da noite de um domingo.
Vai pelo Resend, com um `fetch` — sem SDK e sem processo de aprovação. `RESEND_API_KEY` e
`EMAIL_REMETENTE` ligam o canal; sem elas `canalEmailAtivo()` devolve `false` e quem depende
dele **diz a verdade em vez de fingir que enviou**: `/conta/entrar` não mostra formulário nenhum
e manda falar com o salão.

**O resto é a receção a clicar.** O ecrã `/avisos` é uma fila de quem falta avisar hoje, com o
texto já escrito e um link `wa.me` que abre a conversa no WhatsApp do próprio salão. Não passa
pela API da Meta, portanto não tem tarifa por mensagem nem verificação de empresa; o preço é que
quem carrega em "enviar" é uma pessoa. São cinco rotinas: confirmação, lembrete da véspera,
lembrete de hoje, pedido de avaliação e resgate.

**Não existe agendador**, e é o ponto de projeto que importa: nada acorda às três da manhã para
gerar os avisos de amanhã. A fila é uma consulta — "quem atende amanhã e ainda não tem registo
de lembrete" —, portanto está sempre certa no instante em que a receção abre o ecrã, sem
worker, sem fila de jobs e sem estado a sair de sincronia. O que impede o aviso duplicado é a
linha em `notification_logs`: enviar é gravar, gravar é sair da fila.

---

## 6. Segurança, RGPD e operação

O salão está em Portugal, portanto a lei aplicável é o **RGPD** (Regulamento (UE) 2016/679) e a
autoridade de controlo é a CNPD. O que isso obriga, em termos de sistema:

- **Permissões**: resolvidas no servidor, em `server/auth/permissoes.ts`. A profissional vê a
  própria agenda; o gerente, as lojas dele; a dona, a rede. Os ecrãs de rede desaparecem da navegação
  de quem não pode e **recusam a ação no servidor** — esconder o botão não é permissão.
- **Minimização**: o que o sistema guarda da cliente é nome, telefone, e-mail, data de
  nascimento, preferências e histórico de visitas. Não guarda dado de saúde nem fotografia de
  cliente, porque anamnese e galeria antes/depois não estão construídas — e o dia em que
  estiverem, passam a ser **categoria especial** do artigo 9.º, com consentimento explícito e
  base legal própria.
- **Consentimento**: `consent_records` está desenhado e versionado por `text_version`, à espera
  dessas funcionalidades. Sem consentimento registado, não se usa imagem de cliente.
- **Direitos do titular** (acesso, portabilidade, apagamento, oposição): **ainda não há ecrã para
  nenhum deles.** Hoje respondem-se à mão, no banco. É pendência conhecida, não um detalhe.
- **Retenção**: a factura obriga a guardar o que a factura obriga; o resto não tem prazo
  definido no sistema, e devia ter.
- **Rate limit** no envio de código e na marcação pública (`server/security/`), com o algoritmo
  testado em `packages/core/src/security/`.
- **Backup**: dump diário para o bucket `backups`, com prova de restauro. No plano Free do
  Supabase o nosso backup deixou de ser redundância e passou a ser a única rede — ver
  [ops/backup/README.md](../ops/backup/README.md).
- **Subcontratantes** (o RGPD chama-lhes assim, e é o que são): Supabase para o banco, Railway
  para o site e as imagens, Resend para o e-mail. Todos com dados na União Europeia, o que
  poupa a conversa de transferência internacional.
- **A marca de ambiente vive no banco** (`deployment_env`), não numa variável: o seed apaga tudo
  antes de escrever, e uma variável não protege quem corre o script da própria máquina.

**Auditoria é a lacuna maior.** `audit_logs` existe no schema e nada escreve nela. O rasto que
há de facto é `appointment_status_events`, que cobre mudança de estado da marcação e mais nada —
preço e comanda mudam sem deixar rasto de quem mudou.

---

## 7. Testes

| Tipo | Onde | O que |
|---|---|---|
| Unitário | `packages/core` | Motor de disponibilidade (35 casos: buffers, viragem do dia, feriado, fuso, escolha de profissional), resolução de preço, fuso horário, leitura de CSV, rate limit, assinatura S3 |
| Unitário | `apps/web` | Formatação — dinheiro, data, duração, telefone, e o que muda com o país |

São 127 no total, e correm em pouco mais de um segundo com `npm test`.

O que **não** existe: teste de integração contra banco real (incluindo o caso que mais
interessaria — dois pedidos simultâneos no mesmo horário, um a passar e outro a receber o erro
tratado), teste E2E e teste de carga. A trava anti-overbooking está provada por construção e
conferida no deploy, mas não por um teste que a tente furar.
