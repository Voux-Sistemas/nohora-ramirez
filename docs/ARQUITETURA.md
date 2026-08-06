# Arquitetura técnica

---

## 1. Stack recomendada

| Camada | Escolha | Por quê |
|---|---|---|
| App web | **Next.js 15 (App Router) + TypeScript** | Um codebase serve cliente (PWA) e painel; Server Actions cortam boilerplate de API; SEO na landing das unidades |
| UI | **Tailwind + shadcn/ui** | Velocidade e um visual próprio sem virar refém de design system alheio |
| Banco | **PostgreSQL 16** | Precisamos de `tstzrange` + `btree_gist` para a trava de agenda. Não é opcional |
| ORM | **Drizzle ORM** | SQL-first, tipado, e não atrapalha quando precisamos escrever a query do motor de disponibilidade na mão |
| Auth | Cliente: **telefone + OTP** · Staff: **e-mail + senha + 2FA opcional** | Conversão do cliente brasileiro despenca com formulário de senha |
| Filas/cron | **pg-boss** (jobs no próprio Postgres) | Lembretes, campanhas, fechamento de comissão. Evita Redis no começo |
| Realtime (chat) | **WebSocket** (servidor Node dedicado) ou **Supabase Realtime** | Depende da decisão de infra abaixo |
| Arquivos | **Cloudflare R2** ou **S3** | Fotos antes/depois, anexos de chat |
| Pagamentos | **Asaas** ou **Mercado Pago** | Pix instantâneo com webhook confiável é o requisito principal |
| WhatsApp | **Meta Cloud API** (oficial) | Templates *utility* praticamente sem custo; API não oficial dá ban |
| E-mail | **Resend** | Transacional simples |
| Erros/observabilidade | **Sentry** + logs estruturados | |
| Deploy | **Railway** (app + Postgres + worker) | Você já tem Railway conectado aqui; Postgres gerenciado, deploy por push, barato nessa escala |

### Duas opções de infra (decisão em aberto)

**Opção A — Railway "tudo nosso"** *(recomendada)*
Next.js + Postgres + worker de jobs + servidor WS, tudo no Railway. Controle total, sem vendor lock, custo previsível (~US$ 20-40/mês nessa escala). Custo: implementar auth, realtime e storage nós mesmos.

**Opção B — Supabase + Vercel**
Supabase entrega auth, Postgres, realtime, storage e RLS prontos. Chega mais rápido ao MVP. Custo: RLS com regra multi-unidade e multi-papel fica complexa, e parte da lógica escapa para o banco.

> Recomendação: **A**, com Railway. O sistema tem muita regra de negócio no servidor (comissão, comanda, disponibilidade) — RLS não é o modelo natural aqui, e o Railway já está à mão.

---

## 2. Estrutura do projeto

```
salao/
├── apps/
│   ├── web/                    # Next.js — cliente + painel
│   │   ├── app/
│   │   │   ├── (site)/         # landing pública, páginas das 3 unidades
│   │   │   ├── (cliente)/      # PWA: agendar, histórico, chat, pacotes
│   │   │   ├── (painel)/       # agenda, comanda, caixa, clientes, estoque
│   │   │   ├── (rede)/         # BI, comissão, financeiro, configurações
│   │   │   └── api/            # webhooks (pagamento, whatsapp), rotas públicas
│   │   └── components/
│   ├── worker/                 # pg-boss: lembretes, campanhas, fechamentos
│   └── realtime/               # servidor WebSocket do chat
├── packages/
│   ├── db/                     # schema Drizzle + migrations + seed
│   ├── core/                   # ⬅ domínio: availability, pricing, commission,
│   │                           #    booking, stock, loyalty (puro, testável)
│   ├── integrations/           # whatsapp, pagamento, storage, email
│   └── ui/                     # design system compartilhado
└── docs/
```

**Regra de ouro:** `packages/core` não importa Next, não importa Drizzle, não sabe o que é HTTP. Regra de negócio pura, com teste unitário. É o que garante que o cálculo de comissão e o motor de disponibilidade sejam confiáveis.

---

## 3. Motor de disponibilidade

O componente mais crítico. Assinatura conceitual:

```ts
type SlotQuery = {
  unitId: string
  services: { serviceId: string; staffId?: string }[]  // carrinho em sequência
  dateRange: { from: Date; to: Date }
  granularityMin: number        // 5 | 10 | 15
  clientId?: string             // para regras específicas do cliente
}

type Slot = {
  startsAt: Date
  items: { serviceId: string; staffId: string; resourceId: string;
           startsAt: Date; endsAt: Date }[]
  totalPrice: number
  totalDurationMin: number
}

function findAvailableSlots(q: SlotQuery, ctx: AvailabilityContext): Slot[]
```

### Algoritmo

```
1. CARREGAR CONTEXTO (1 query por tipo, nunca N+1)
   - unit_hours + unit_exceptions do período
   - staff elegíveis  = staff_units ∩ staff_skills(serviço) ∩ accepts_online_booking
   - staff_schedules + staff_time_off do período
   - appointment_items ativos do período (por staff e por resource)
   - resources da unidade por resource_type exigido
   - service_pricing resolvido (preço + duração por staff)

2. MONTAR JANELAS LIVRES
   para cada staff:
     livre[staff] = (escala ∩ horário da unidade) − time_off − ocupações_ativas
   para cada resource:
     livre[resource] = horário da unidade − ocupações

3. VARRER A GRADE
   para cada instante t na granularidade, dentro do horário da unidade:
     tentar encaixar o carrinho em sequência:
       para cada serviço i do carrinho:
         escolher staff (o pedido, ou o "melhor" entre os elegíveis)
         segmentos ativos  = [setup] e [finish]      → precisa staff livre
         segmento passivo  = [processing]            → staff LIVRE, resource ocupado
         resource precisa estar livre de setup até finish
         aplicar buffer_before / buffer_after
         próximo serviço começa ao fim deste (com folga configurável)
       se todos couberem → é um slot válido

4. FILTRAR POR REGRAS
   - antecedência mínima (agora + X)  e máxima (agora + Y dias)
   - unidade fechada / feriado
   - limite de agendamentos futuros do cliente
   - serviço exige avaliação prévia?

5. ORDENAR / DISTRIBUIR
   Quando "sem preferência": escolher o profissional que
   (a) minimiza buraco na agenda, (b) equilibra a carga do dia.
```

### Gap booking (o pulo do gato)
Numa coloração `setup=30 · processing=40 · finish=30`, o profissional fica ocupado 60 min, não 100. Os 40 min de processamento voltam para a grade dele — cabe uma escova rápida ali. É isso que enche a agenda sem contratar ninguém.

Implementação: `appointment_items.staff_busy_ranges` guarda só os blocos ativos; o `resource` fica reservado o período inteiro.

### Concorrência
```sql
-- na tabela appointment_items
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointment_items
  ADD CONSTRAINT no_staff_overlap
  EXCLUDE USING gist (
    staff_id WITH =,
    active_range WITH &&
  ) WHERE (status_active);

ALTER TABLE appointment_items
  ADD CONSTRAINT no_resource_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    full_range WITH &&
  ) WHERE (status_active);
```
A criação do agendamento roda numa transação; se a constraint estourar, a API devolve "esse horário acabou de ser preenchido" e reapresenta os slots. Simples e à prova de corrida.

### Performance
- Cache dos slots por (unidade, serviço, dia) com invalidação em qualquer escrita de agenda
- Pré-computar disponibilidade dos próximos 14 dias em background
- Meta: resposta < 300 ms para um mês de grade

---

## 4. Chat em tempo real

```
Cliente (PWA)  ──WS──┐
Recepção       ──WS──┼── realtime server ── Postgres (messages)
Profissional   ──WS──┘         │
                               └── pg-boss → push (Web Push) para offline

WhatsApp Cloud API ──webhook──> /api/webhooks/whatsapp
                                  └─> cria/roteia Conversation e Message
                                      (mesma caixa de entrada)
Saída: dentro da janela de 24h → mensagem livre
       fora da janela          → template aprovado
```

- Uma `conversation` por (cliente × unidade); a recepção da unidade vê a fila.
- Presença e "digitando" via canal do WS.
- Anexos: upload direto para R2 com URL pré-assinada; a mensagem guarda só a chave.
- Não lidas por participante via `conversation_participants.last_read_at`.
- Chat interno: conversas `type=internal`, por unidade ou da rede toda.

---

## 5. Notificações — cadência automática

| Gatilho | Quando | Canal |
|---|---|---|
| Agendamento criado | imediato | WhatsApp (utility) + push |
| Lembrete | 24h antes | WhatsApp com botão Confirmar / Remarcar / Cancelar |
| Lembrete do dia | 3h antes | WhatsApp |
| Sinal pendente | 30 min após criar | WhatsApp + link Pix |
| Pós-atendimento | 2h depois | pedido de avaliação |
| Vaga na lista de espera | ao cancelar | push + WhatsApp, com janela de 15 min para aceitar |
| Reativação | 60 dias sem visita | WhatsApp (marketing) |
| Aniversário | no dia | WhatsApp (marketing) |
| Fechamento de comissão | dia 1 do mês | e-mail + painel do profissional |

Tudo agendado no `pg-boss`, com `notification_logs` registrando envio, custo e resultado. Cancelamento de agendamento cancela os jobs pendentes dele.

---

## 6. Segurança, LGPD e operação

- **Permissões**: middleware que resolve `(user, unit, action, resource)`. Profissional só enxerga a própria agenda e o próprio extrato; recepção só a unidade dela; dona vê tudo.
- **Dado sensível**: anamnese e fotos são dado pessoal sensível. Criptografia em repouso, acesso logado em `audit_logs`, consentimento explícito versionado em `consent_records`.
- **Direitos do titular**: exportar e excluir dados do cliente, com anonimização do que precisa permanecer por obrigação fiscal.
- **Auditoria**: toda alteração de agenda, comanda, preço, comissão e estoque grava `before`/`after`.
- **Backup**: snapshot diário do Postgres + PITR; restauração testada uma vez por trimestre.
- **Rate limit** no agendamento público e no envio de OTP.
- **Ambientes**: `dev` → `staging` (com dados fictícios) → `prod`. Nunca testar em produção com cliente real na agenda.

---

## 7. Testes

| Tipo | Onde | O que |
|---|---|---|
| Unitário | `packages/core` | Motor de disponibilidade (foco em gap booking, buffers, virada de dia, feriado, fuso), cálculo de comissão, resolução de preço, consumo de pacote |
| Integração | API + banco real | Fluxo de reserva concorrente (2 pedidos simultâneos → 1 sucesso, 1 erro tratado), fechamento de comanda, baixa de estoque |
| E2E (Playwright) | Web | Agendar → lembrete → check-in → comanda → pagamento → comissão |
| Carga | k6 | 200 buscas de slot simultâneas |

O motor de disponibilidade precisa de uma suíte de casos escrita **antes** do código. É onde bugs custam dinheiro e cliente.
