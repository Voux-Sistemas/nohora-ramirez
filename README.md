# Sistema para Estúdio de Beleza — 3 unidades

Plataforma própria de agendamento e gestão para estúdio de beleza multi-unidade.
White-label, sem marketplace, sem taxa por agendamento.

> **Status:** planejamento concluído · aguardando decisões técnicas para iniciar a Fase 0

## Documentação

| Documento | Para quê |
|---|---|
| [PROMPT-MESTRE.md](PROMPT-MESTRE.md) | **Comece aqui.** Contexto, regras e padrões do projeto |
| [docs/PESQUISA.md](docs/PESQUISA.md) | Como funcionam Booksy, Fresha, Trinks e Avec + glossário do negócio |
| [docs/PRODUTO.md](docs/PRODUTO.md) | Personas, módulos e checklist completo de funcionalidades |
| [docs/MODELO-DADOS.md](docs/MODELO-DADOS.md) | Entidades, campos e regras de integridade |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Stack, estrutura do repo, motor de disponibilidade, chat |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Fases, riscos, estratégia de rollout e KPIs |

## Ver a correr

Falta só a ligação a um Postgres — o passo a passo está em
[COMO-VER.md](COMO-VER.md). Depois: `npm run dev` → http://localhost:3000

## O mapa do sistema

Duas áreas, duas cascas. A cliente tem quatro telas; a equipa tem uma casca só
com seis secções, e a casa activa mora num cookie em vez de no endereço.

| Cliente | | Equipa | |
|---|---|---|---|
| `/` | a página | `/painel` | Hoje — a grade do dia |
| `/casa/[slug]` | a casa | `/painel/agenda` | a agenda de uma pessoa: dia · semana · mês |
| `/marcar` | **a marcação, numa tela** | `/painel/clientes` · `/painel/caixa` · `/painel/avisos` | a operação |
| `/minha-conta` | próximas visitas e histórico | `/painel/gestao/…` | casas, catálogo, equipa, comissões |

Entrar: `/entrar` é da cliente (telemóvel + código), `/entrar/equipa` é de quem
trabalha na casa (telemóvel + senha). Os endereços antigos (`/loja/…`,
`/agendar`, `/conta`, `/admin`, …) continuam a funcionar por redireccionamento
— o link da bio do Instagram não se reescreve.

## Em uma frase

O cliente marca sozinho pelo celular, a recepção opera comanda e caixa na mesma tela,
o profissional vê a comissão em tempo real e a dona enxerga as 3 unidades num painel só.

## Próximo passo

Fase 0 do [roadmap](docs/ROADMAP.md): travar as decisões técnicas, levantar o catálogo real
de serviços/durações/preços das 3 unidades e montar o repositório.
