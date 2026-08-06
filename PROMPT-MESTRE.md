# Prompt mestre do projeto

Este é o documento de referência que descreve o projeto de forma completa e reutilizável.
Serve para (a) alinhar quem entrar no projeto, (b) ser colado no início de qualquer sessão de desenvolvimento.

> **Placeholders entre `{{ }}` precisam ser preenchidos antes do primeiro dia de código.**

---

## Contexto

Sou dono de um estúdio de beleza com **3 unidades** em `{{cidades/bairros}}`.
Hoje a operação é `{{agenda de papel / WhatsApp / planilha / sistema X}}`.
Quero um **sistema próprio**, sob minha marca, que substitua isso — sem depender de marketplace de terceiro nem pagar taxa por agendamento.

Serviços oferecidos: `{{ex.: corte, coloração, mechas, escova, progressiva, manicure, pedicure, design de sobrancelha, cílios, estética facial}}`.
Equipe: `{{N}}` profissionais no total, `{{N}}` recepcionistas.
Volume: aproximadamente `{{N}}` atendimentos/mês por unidade.

## Objetivo

Construir uma plataforma web (PWA) com três frentes:

1. **App do cliente** — agendar 24/7, escolher unidade, serviço e profissional, ver histórico, conversar por chat com o estúdio, acompanhar pacotes e fidelidade.
2. **Painel operacional** — agenda multicoluna por profissional, comanda, caixa, cadastro de clientes, ficha de anamnese, estoque e chat.
3. **Painel da rede** — visão consolidada das 3 unidades, comissões, financeiro, relatórios e configuração de regras.

## O que torna este sistema diferente de um agendador genérico

Estes cinco pontos são requisitos, não desejos:

1. **Duração composta com tempo de processamento.** Serviços químicos têm aplicação → processamento → finalização. O profissional fica livre durante o processamento e a agenda dele deve refletir isso (gap booking).
2. **Recursos físicos.** Um agendamento reserva profissional **e** cabine/lavatório/equipamento. A agenda precisa impedir conflito de sala, não só de pessoa.
3. **Preço e duração variáveis por profissional e por unidade.** Sênior e júnior não cobram nem demoram o mesmo.
4. **Multi-unidade real.** Operação isolada por unidade, cliente e histórico únicos na rede, visão consolidada para o dono, transferência de estoque entre unidades.
5. **Comissão com regra composta.** % por profissional/serviço, com desconto opcional de material e de taxa de cartão, faixas por meta, e extrato em tempo real no celular do profissional.

## Regras de negócio

- Antecedência mínima para agendar: `{{2h}}` · máxima: `{{60 dias}}`
- Cancelamento sem multa até `{{24h}}` antes
- Sinal antecipado: `{{obrigatório para serviços acima de R$ X / apenas para química / não usar por enquanto}}`
- Política de no-show: `{{retém sinal / cobra taxa de X% / apenas registra}}`
- Cliente com `{{3}}` no-shows passa a exigir sinal
- Granularidade da grade: `{{15}}` minutos
- Buffer padrão entre atendimentos: `{{10}}` minutos
- Descontos acima de `{{15}}`% exigem aprovação de gerente

## Stack

- **Next.js 15 (App Router) + TypeScript**, Tailwind + shadcn/ui
- **PostgreSQL 16** com `btree_gist` para trava de agenda por intervalo
- **Drizzle ORM**
- Auth: cliente por telefone + OTP; staff por e-mail + senha
- **pg-boss** para jobs (lembretes, campanhas, fechamentos)
- Chat em tempo real por WebSocket
- **WhatsApp Cloud API** (oficial) para confirmações e lembretes
- Pagamento via `{{Asaas / Mercado Pago}}` com foco em Pix
- Deploy no **Railway** (app + Postgres + worker + realtime)
- Monorepo com `packages/core` contendo o domínio puro e testável

## Padrões inegociáveis

1. Regra de negócio mora em `packages/core`, sem dependência de framework, com teste unitário.
2. Motor de disponibilidade tem os testes escritos **antes** da implementação.
3. Trava anti-overbooking é constraint de exclusão no Postgres — não confiar em checagem de aplicação.
4. Todo horário em `timestamptz` (UTC); conversão sempre pelo fuso **da unidade**.
5. Preço é congelado no momento do evento; mudar tabela de preços não reescreve o passado.
6. Comanda fechada é imutável; correção só por estorno com registro em auditoria.
7. Toda alteração de agenda, comanda, preço, comissão e estoque grava `before`/`after` em `audit_logs`.
8. Anamnese e fotos são dado sensível: consentimento versionado, acesso logado, criptografia em repouso.
9. Interface em **pt-BR**, moeda em BRL, datas no formato brasileiro.
10. Mobile-first — a recepção e os profissionais usam celular o tempo todo.

## Como quero que o trabalho aconteça

- Entregar por fases, com critério de pronto claro em cada uma (ver `docs/ROADMAP.md`).
- Não inflar escopo: o que não está na fase atual não entra.
- Antes de implementar algo com regra ambígua, perguntar em vez de assumir.
- Commits pequenos e descritivos; migrations sempre versionadas e reversíveis.
- Sempre que uma decisão técnica for tomada, registrar em `docs/DECISOES.md`.

## Documentos de referência

| Arquivo | Conteúdo |
|---|---|
| `docs/PESQUISA.md` | Como funcionam Booksy, Fresha, Trinks e Avec + glossário do negócio |
| `docs/PRODUTO.md` | Personas, módulos e lista completa de funcionalidades |
| `docs/MODELO-DADOS.md` | Entidades, campos e regras de integridade |
| `docs/ARQUITETURA.md` | Stack, estrutura do repo, motor de disponibilidade, chat, notificações |
| `docs/ROADMAP.md` | Fases, sprints, riscos, rollout e KPIs |

---

## Prompt curto (para colar no início de uma sessão)

```
Estou construindo um sistema de gestão e agendamento para um estúdio de beleza
com 3 unidades. Leia PROMPT-MESTRE.md e os arquivos em docs/ antes de começar.

Stack: Next.js 15 + TypeScript + PostgreSQL + Drizzle, monorepo, deploy no Railway.
Regra de negócio pura e testada em packages/core.

Estamos na Fase {{N}} do docs/ROADMAP.md. A tarefa de hoje é: {{tarefa}}.

Siga os padrões inegociáveis do PROMPT-MESTRE.md. Se alguma regra estiver
ambígua, pergunte antes de implementar.
```
