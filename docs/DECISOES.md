# Registo de decisões (ADR)

Toda decisão técnica relevante entra aqui, com data e motivo. Nunca apagar uma decisão — se mudar, adicionar uma nova revogando a anterior.

---

## ADR-001 · Infraestrutura no Railway
**Data:** 2026-08-04 · **Status:** aceita · **Parcialmente revogada pelo ADR-009** (o banco sai do Railway; o resto vale)

Todo o stack corre no Railway: app Next.js, PostgreSQL gerido, worker de jobs e servidor de realtime.

**Motivo:** controlo total sobre a regra de negócio (comissão, comanda e disponibilidade são lógica de servidor, não de RLS), custo previsível (~US$ 30/mês nessa escala), sem vendor lock, e o Railway já está integrado ao ambiente de desenvolvimento.

**Alternativa descartada:** Supabase + Vercel. Chegaria mais rápido ao MVP, mas a regra multi-unidade × multi-papel via RLS ficaria complexa e espalharia lógica de negócio pelo banco.

---

## ADR-002 · MVP é agendamento; comanda e caixa só na Fase 2
**Data:** 2026-08-04 · **Status:** aceita

A Fase 1 entrega apenas o ciclo de agendamento multi-unidade com lembretes. Comanda, caixa, comissão e pagamento entram na Fase 2, depois de a Fase 1 estar a correr de verdade numa unidade.

**Motivo:** tentar entregar operação financeira junto com agendamento é o padrão de falha desse tipo de projeto. Cada fase tem critério de pronto e nada entra fora de fase.

---

## ADR-003 · Asaas como gateway de pagamento
**Data:** 2026-08-04 · **Status:** **revogada pelo ADR-010** (gateway brasileiro; o salão é português)

Sinal antecipado via Pix e links de pagamento pelo Asaas.

**Motivo:** melhor aderência a negócio de serviço no Brasil, Pix instantâneo com webhook confiável, split nativo (útil quando o repasse de comissão for automatizado) e taxa menor que a do Mercado Pago em Pix.

**Alternativa descartada:** Mercado Pago — mais conhecido pelo consumidor, mas sem vantagem operacional para o nosso caso.

---

## ADR-004 · Chat com caixa de entrada unificada (app + WhatsApp)
**Data:** 2026-08-04 · **Status:** aceita · **Entra na Fase 3, preparação na Fase 1**

O chat do app e as mensagens do WhatsApp chegam à mesma caixa de entrada da receção, via WhatsApp Cloud API oficial.

**Motivo:** a receção não pode operar em dois ecrãs. Conversa solta no WhatsApp pessoal é perda de histórico e risco de RGPD.

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

Disponibilidade, precificação, comissão, consumo de pacote e regras de agendamento vivem num pacote puro, sem dependência de Next, de HTTP ou do ORM.

**Motivo:** é o que permite testar exaustivamente a parte do sistema onde erro custa dinheiro e confiança do cliente. Os testes do motor de disponibilidade são escritos antes da implementação.

---

## ADR-008 · Produto primeiro com dados fictícios; onboarding e WhatsApp por último
**Data:** 2026-08-04 · **Status:** aceita · **Revoga a ordem de fases do ADR-002 e do ADR-004**

O sistema é um **produto para vender a clientes**, não uma ferramenta para um único estúdio. Muda a ordem de construção:

1. Um estúdio fictício completo entra por seed. Nada de esperar dado real para poder ver ecrã.
2. Constrói-se a aplicação inteira em cima dele — agendamento, agenda da receção, registos, ficha do cliente, comanda, caixa e comissão.
3. **Depois** de o produto estar de pé, constrói-se o onboarding: o wizard que um cliente novo usa para colocar os dados dele.
4. **Por último** o WhatsApp e as notificações.

**Motivo:** decisão do dono do produto. O produto precisa de ser demonstrável antes de ser vendido, e onboarding só faz sentido quando existe um sistema para dentro do qual carregar dados. Empurrar as notificações para o fim é deliberado: é a parte que depende de aprovação externa da Meta e de infraestrutura de fila, e travar o desenvolvimento nela seria trocar progresso visível por burocracia.

**Consequências:**
- **A verificação Meta Business sai do caminho crítico.** Desaparece da Fase 0. Só volta a importar quando o WhatsApp for construído — mas continua a levar ~1 semana, portanto precisa de ser aberta com essa antecedência antes daquela etapa. Não é para esquecer, é para lembrar na hora certa.
- Os CSVs em `dados/` deixam de ser pré-requisito. Passam a ser **material de referência do formato de importação** — o onboarding vai ler exatamente esse formato.
- A comanda e o caixa deixam de ser "Fase 2 depois do piloto" (ADR-002) e entram na construção contínua do produto, porque um sistema sem fecho de caixa não é vendável.
- O seed passa a ser infraestrutura de primeira classe: é o ambiente de demonstração comercial e a base dos testes de integração. Tem de ser realista, não três linhas de exemplo.

---

## ADR-009 · Banco no Supabase, site no Railway, tudo na Europa
**Data:** 2026-08-14 · **Status:** aceita · **Revoga do ADR-001 apenas a parte de infraestrutura de banco**

O PostgreSQL sai do Railway e passa a ser um projeto Supabase (PG17, região Frankfurt, plano Free). O site Next.js continua no Railway, e **muda de San Jose para Amesterdão**.

O Supabase entra aqui **como Postgres gerido, não como plataforma**. Sem RLS, sem Supabase Auth, sem `supabase-js`. As permissões continuam em `server/auth/permissoes.ts`, em TypeScript, testáveis fora do banco.

**Motivo:** operação. O trabalho de inspecionar e corrigir o banco hoje passa por escrever script temporário, porque o Postgres do Railway não tem endereço público — só existe dentro da rede privada. Com o Supabase há painel, editor de SQL e acesso por ferramenta. É ganho de velocidade de manutenção, não de arquitetura.

**Por que a região muda junto.** O `web` estava em San Jose e as clientes estão no Porto: cada visita já atravessava o Atlântico. Deixar o banco na Europa com o site na Califórnia somaria uma travessia **por query** — as páginas são todas `force-dynamic` e várias fazem quatro ou cinco. Mover as duas peças para a Europa é o que faz a migração sair mais rápida do que o estado anterior, em vez de apenas menos lenta do que a alternativa má.

**O argumento do ADR-001 que continua de pé:** regra multi-unidade × multi-papel não vai para RLS. Ele descartava o Supabase por causa disso, e isso não mudou — o que mudou é que dá para usar o Postgres do Supabase sem usar o RLS dele.

**Consequências:**
- **Duas URLs, não uma.** `DATABASE_URL` no pooler de transação (6543, sem prepared statements) para o site; `DIRECT_URL` no pooler de sessão (5432) para migration, constraints e seed. Nunca o endereço "Direct connection": é IPv6-only e a saída do Railway é IPv4. Detalhes e motivo em `packages/db/src/index.ts` e no `.env.example`.
- **O banco ganha superfície pública.** Antes era inalcançável fora da rede do Railway. Compensação: o site deixa de se ligar como dono do banco e passa a usar um papel só com DML — se houver injeção de SQL em algum canto, ela não derruba tabela. É uma melhoria que não existia antes e que a migração paga.
- **Plano Free significa que o backup próprio deixa de ser redundância e passa a ser a única rede.** O `ops/backup` continua, repontado para o Supabase, e a prova semanal de restore passa a importar mais do que importava, não menos. O Free também suspende após 7 dias sem tráfego — o salão em funcionamento não chega lá, mas é uma condição a monitorizar, não uma garantia.
- **Latência sobe.** De ~0,5 ms na rede privada para dezenas de ms entre fornecedores, mesmo com as duas peças na Europa. Multiplica por query. Se algum ecrã ficar lento, a causa provável é número de queries por página, e a correção é agrupar consulta — não voltar atrás.
- **O rollback tem prazo.** O Postgres do Railway fica de pé e intocado por ~14 dias, e voltar é repor duas variáveis. Mas escrita feita no Supabase depois do corte não existe lá atrás: o rollback é limpo na primeira hora e, passado o primeiro dia, significa perder marcações reais.

---

## ADR-010 · Sem cobrança online: o Asaas e o Pix saem do plano
**Data:** 2026-08-14 · **Status:** aceita · **Revoga o ADR-003 por inteiro**

O sinal antecipado e o link de pagamento deixam de estar previstos pelo Asaas, e **nenhum gateway entra no lugar por agora**. O dinheiro continua a ser recebido ao balcão e lançado na comanda, que é como o salão já trabalha.

**Motivo:** o ADR-003 foi escrito a imaginar um salão no Brasil. O cliente real está em Valongo e na Maia, distrito do Porto. O Asaas é um adquirente brasileiro e o Pix é um sistema de pagamentos do banco central do Brasil — não existe em Portugal, nem do lado de quem cobra nem do lado de quem paga. As duas metades do ADR-003 caem juntas, e não caem por preço nem por qualidade: caem por geografia. Escolher hoje o substituto europeu seria decidir sem necessidade, porque nenhum ecrã do sistema cobra dinheiro à distância e nada no salão está à espera disso.

**Consequências:**

- **O sinal continua modelado e não cobrado.** `services.requires_deposit`, `deposit_type` e `deposit_value`, e `appointments.deposit_required`/`deposit_paid_at`, existem no schema e são gravados. Nenhum deles fala com um banco: marcar um serviço como "exige sinal" só quer dizer que a receção sabe que tem de o pedir, e `deposit_paid_at` só se preenche quando alguém confirmar à mão. Isto é o estado real, não uma implementação por acabar.
- **A política de falta perde o único braço que a ADR-003 lhe dava.** Sem retenção de sinal, o que resta contra o não-comparecimento é `client_profiles.no_show_count` e a marca `requires_deposit` na ficha da cliente — informação para a receção decidir, não cobrança automática.
- **`pix` continua no enum `payment_method`, mas sai da lista do balcão.** Tirar do enum exige migração e não vale a pena: o valor tem de continuar a existir para as comandas antigas se lerem, e uma instalação brasileira volta a precisar dele. O que muda é quem escolhe — `metodosDoPais()` monta a lista a partir de `pais()`, e em Portugal o Pix não aparece. Estava, e ainda por cima **pré-selecionado na primeira linha**: quem fechasse a comanda sem abrir o seletor registava todos os dias um pagamento que não aconteceu, e o fecho do caixa deixava de bater com a gaveta. Agora nada vem escolhido de origem.
- **Quando a cobrança à distância voltar a fazer sentido, escreve-se um ADR novo.** Não é reabrir o ADR-003 com outro nome no lugar do Asaas: a pergunta muda com o país, e a resposta tem de sair de fornecedores que operem em euros e na zona SEPA.

---

## ADR-011 · Subir as dependências vulneráveis, mas ficar no Next 15
**Data:** 2026-08-14 · **Status:** aceita

`npm audit` acusava treze avisos, um deles **crítico**. Subiram quatro pacotes e a lista caiu para quatro avisos, todos sem correção disponível abaixo de uma mudança maior:

| Pacote | De | Para | O que fecha |
| --- | --- | --- | --- |
| `drizzle-orm` | 0.38.3 | 0.45.2 | **injeção de SQL** por identificador mal escapado (alta) |
| `vitest` | 2.1.8 | 4.1.10 | leitura e execução de ficheiro arbitrário pelo servidor da UI (crítica), e o `vite` vulnerável que vinha junto (alta) |
| `next` | 15.1.3 | 15.5.23 | correções da própria framework acumuladas em cinco menores |
| `drizzle-kit` | 0.30.1 | 0.31.10 | o que dava para fechar da cadeia do `esbuild` |

O `drizzle-orm` era o que importava. Ele é o caminho de **toda** a leitura e escrita do sistema, e a falha estava no escape de identificadores — exatamente o que um ORM existe para garantir.

**O que fica por fechar, e porquê.** As três primeiras vêm dentro do `next` e do `drizzle-kit`, que as fixam em versão exata; um `overrides` no `package.json` não pega nelas — foi tentado e o npm não o aplica a dependência fixada por um pacote do espaço de trabalho.

- **`postcss` 8.4.31 dentro do `next`** (alta). As falhas são de XSS e de leitura de ficheiro ao processar CSS de origem desconhecida. O único CSS que passa por aqui é o nosso, em tempo de build. Exposição real: nenhuma.
- **`sharp` 0.34.5 dentro do `next`** (alta). Herda CVEs do `libvips`. Esta corre, sim, em produção: é o que o `next/image` usa para redimensionar as fotografias. Para a explorar é preciso conseguir enviar uma imagem deformada, e enviar imagem exige sessão de gestão — o atacante teria de ser já alguém da equipa. É a única das quatro com superfície a sério, e é o argumento a pesar quando se decidir o Next 16.
- **`esbuild` dentro do `drizzle-kit`** (moderada). A falha é do servidor de desenvolvimento do `esbuild`, que este projeto nunca levanta: o `drizzle-kit` só corre em linha de comandos, para gerar e aplicar migrations. Não vai para produção.

**Porque não o Next 16.** É a única correção para as duas primeiras, e é uma versão maior — muda APIs, tira o `next lint` e obriga a revalidar o produto inteiro. Fazê-lo na véspera de pôr o primeiro cliente a trabalhar troca um risco teórico por um risco real. Fica marcado no `docs/ROADMAP.md` para logo depois do arranque, e não mais tarde do que isso.

**O linter passou a existir.** Havia nove `// eslint-disable-next-line` no código a pedir dispensa a um ESLint que ninguém tinha instalado — comentário que não desliga nada e faz quem lê supor uma regra que não existe. Agora existe: `npm run lint`, com `next/core-web-vitals` e `no-console` (ver `apps/web/eslint.config.mjs`). Apanhou logo cinco erros a sério, incluindo dois `<a>` onde devia estar `<Link>`.
