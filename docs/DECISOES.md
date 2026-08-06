# Registro de decisões (ADR)

Toda decisão técnica relevante entra aqui, com data e motivo. Nunca apagar uma decisão — se mudar, adicionar uma nova revogando a anterior.

---

## ADR-001 · Infraestrutura no Railway
**Data:** 2026-08-04 · **Status:** aceita

Todo o stack roda no Railway: app Next.js, PostgreSQL gerenciado, worker de jobs e servidor de realtime.

**Motivo:** controle total sobre a regra de negócio (comissão, comanda e disponibilidade são lógica de servidor, não de RLS), custo previsível (~US$ 30/mês nessa escala), sem vendor lock, e o Railway já está integrado ao ambiente de desenvolvimento.

**Alternativa descartada:** Supabase + Vercel. Chegaria mais rápido ao MVP, mas a regra multi-unidade × multi-papel via RLS ficaria complexa e espalharia lógica de negócio pelo banco.

---

## ADR-002 · MVP é agendamento; comanda e caixa só na Fase 2
**Data:** 2026-08-04 · **Status:** aceita

A Fase 1 entrega apenas o ciclo de agendamento multi-unidade com lembretes. Comanda, caixa, comissão e pagamento entram na Fase 2, depois de a Fase 1 estar rodando de verdade em uma unidade.

**Motivo:** tentar entregar operação financeira junto com agendamento é o padrão de falha desse tipo de projeto. Cada fase tem critério de pronto e nada entra fora de fase.

---

## ADR-003 · Asaas como gateway de pagamento
**Data:** 2026-08-04 · **Status:** aceita · **Entra na Fase 2**

Sinal antecipado via Pix e links de pagamento pelo Asaas.

**Motivo:** melhor aderência a negócio de serviço no Brasil, Pix instantâneo com webhook confiável, split nativo (útil quando o repasse de comissão for automatizado) e taxa menor que a do Mercado Pago em Pix.

**Alternativa descartada:** Mercado Pago — mais conhecido pelo consumidor, mas sem vantagem operacional para o nosso caso.

---

## ADR-004 · Chat com caixa de entrada unificada (app + WhatsApp)
**Data:** 2026-08-04 · **Status:** aceita · **Entra na Fase 3, preparação na Fase 1**

O chat do app e as mensagens do WhatsApp chegam na mesma caixa de entrada da recepção, via WhatsApp Cloud API oficial.

**Motivo:** a recepção não pode operar em duas telas. Conversa solta no WhatsApp pessoal é perda de histórico e risco de LGPD.

**Consequência com prazo:** a verificação da conta no Meta Business e a aprovação dos templates levam cerca de uma semana. **Iniciar esse processo já na Fase 0**, senão ele vira gargalo da Fase 1 (lembretes automáticos dependem de template aprovado).

---

## ADR-005 · npm workspaces em vez de pnpm
**Data:** 2026-08-04 · **Status:** aceita

Monorepo com workspaces nativos do npm.

**Motivo:** o ambiente já tem npm 11 e Node 24; evita mais uma ferramenta na máquina e no CI. Se o monorepo crescer a ponto de o install incomodar, migrar para pnpm é trivial.

---

## ADR-006 · Drizzle ORM
**Data:** 2026-08-04 · **Status:** aceita

**Motivo:** o motor de disponibilidade exige SQL escrito à mão com `tstzrange` e `btree_gist`, algo que o Prisma não expressa bem. Drizzle é SQL-first, totalmente tipado e não atrapalha quando precisamos descer ao SQL.

---

## ADR-007 · Regra de negócio isolada em `packages/core`
**Data:** 2026-08-04 · **Status:** aceita

Disponibilidade, precificação, comissão, consumo de pacote e regras de agendamento vivem em um pacote puro, sem dependência de Next, de HTTP ou do ORM.

**Motivo:** é o que permite testar exaustivamente a parte do sistema onde erro custa dinheiro e confiança do cliente. Os testes do motor de disponibilidade são escritos antes da implementação.

---

## ADR-008 · Produto primeiro com dados fictícios; onboarding e WhatsApp por último
**Data:** 2026-08-04 · **Status:** aceita · **Revoga a ordem de fases do ADR-002 e do ADR-004**

O sistema é um **produto para vender a clientes**, não uma ferramenta para um único estúdio. Muda a ordem de construção:

1. Um estúdio fictício completo entra por seed. Nada de esperar dado real para poder ver tela.
2. Constrói-se a aplicação inteira em cima dele — agendamento, agenda da recepção, cadastros, ficha do cliente, comanda, caixa e comissão.
3. **Depois** de o produto estar de pé, constrói-se o onboarding: o wizard que um cliente novo usa para colocar os dados dele.
4. **Por último** o WhatsApp e as notificações.

**Motivo:** decisão do dono do produto. O produto precisa ser demonstrável antes de ser vendido, e onboarding só faz sentido quando existe um sistema para dentro do qual carregar dados. Empurrar as notificações para o fim é deliberado: é a parte que depende de aprovação externa da Meta e de infraestrutura de fila, e travar o desenvolvimento nela seria trocar progresso visível por burocracia.

**Consequências:**
- **A verificação Meta Business sai do caminho crítico.** Some da Fase 0. Só volta a importar quando o WhatsApp for construído — mas continua levando ~1 semana, então precisa ser aberta com essa antecedência antes daquela etapa. Não é para esquecer, é para lembrar na hora certa.
- Os CSVs em `dados/` deixam de ser pré-requisito. Viram **material de referência do formato de importação** — o onboarding vai ler exatamente esse formato.
- A comanda e o caixa deixam de ser "Fase 2 depois do piloto" (ADR-002) e entram na construção contínua do produto, porque um sistema sem fechamento de caixa não é vendável.
- O seed passa a ser infraestrutura de primeira classe: é o ambiente de demonstração comercial e a base dos testes de integração. Tem que ser realista, não três linhas de exemplo.
