# Sistema para estúdio de beleza multi-unidade

Plataforma própria de agendamento e gestão. A cliente marca sozinha pelo telemóvel, o balcão
opera comanda e caixa no mesmo ecrã, a profissional vê a agenda dela no telemóvel e a dona
vê as unidades num painel só.

White-label, sem marketplace, sem taxa por agendamento: o sistema veste a marca do estúdio
cliente, não a nossa.

> **Estado:** em produção. O primeiro cliente real é o **NOHORA RAMIREZ — Beauty Studio**,
> duas unidades (Valongo e Maia), distrito do Porto, Portugal.

## Como correr

Precisa de **Node 22** (está em `.nvmrc`) e de **Docker**.

```sh
npm install
docker compose up -d --wait   # Postgres 17 local, na porta 5432
cp .env.example .env          # já vem apontado para esse banco
npm run db:migrate            # schema + travas anti-overbooking
npm run db:seed               # estúdio fictício completo, para ver telas
npm run dev                   # http://localhost:3000
```

Copiar e correr, sem editar nada: a `DATABASE_URL` do `.env.example` é a do
contentor do `docker-compose.yml`. Quem prefira um PostgreSQL 17 próprio troca
essa linha e ignora o Docker.

O seed monta um estúdio de demonstração inteiro — catálogo, equipa, escalas e marcações. É
esse ambiente que se mostra numa venda, e é sobre ele que se desenvolve. Não é preciso dado
de cliente real para trabalhar.

Sem conta nenhuma no banco, o sistema não deixa entrar ninguém. A primeira conta cria-se em
`/comecar`, e a porta fecha sozinha depois — o mecanismo está em [ops/README.md](ops/README.md).

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção dos três workspaces |
| `npm test` | 165 testes — 135 da regra de negócio (disponibilidade, preço, fuso, janela do mês, CSV, assinatura S3) e 30 da aplicação |
| `npm run typecheck` | `tsc --noEmit` nos três workspaces |
| `npm run db:migrate` | aplica migrations **e** as travas de exclusão |
| `npm run db:seed` | popula o estúdio de demonstração |
| `npm run db:studio` | inspetor visual do banco |

## Estrutura

```
apps/web/          Next.js 15 (App Router, RSC, server actions) — a aplicação inteira
packages/core/     regra de negócio pura: disponibilidade, preço, fuso. Sem Next, sem ORM
packages/db/       schema Drizzle, migrations, travas SQL, seed e cadastro do cliente real
ops/               o que corre em produção fora da aplicação: backup diário, onboarding
dados/             CSVs que definem o formato de importação do onboarding
material/          o que a dona mandou de facto: fotografias das lojas, logo, preçário
docs/              pesquisa, modelo de dados, arquitetura e o registo de decisões
```

O motor de disponibilidade vive em `packages/core` de propósito (ADR-007): é a parte do
sistema onde um erro custa dinheiro e confiança, e ali dá para o testar exaustivamente sem
subir servidor nem banco.

## Documentação

| Documento | Para quê |
|---|---|
| [CONTRIBUIR.md](CONTRIBUIR.md) | **Quem chega agora ao código começa aqui.** Do zero ao site a correr, o que publica e o que não publica, e as armadilhas que já custaram caro |
| [PRODUCT.md](PRODUCT.md) | A verdade durável do produto: quem usa, o que é, o que não pode ser inventado |
| [DESIGN.md](DESIGN.md) | O sistema visual: tokens, tipografia, tema claro/escuro, componentes |
| [docs/DECISOES.md](docs/DECISOES.md) | Toda decisão técnica, com data e motivo. Nunca se apaga uma — revoga-se |
| [docs/ARQUITETURA.md](docs/ARQUITETURA.md) | Stack, motor de disponibilidade, autenticação |
| [docs/MODELO-DADOS.md](docs/MODELO-DADOS.md) | Entidades, campos e regras de integridade |
| [docs/PESQUISA.md](docs/PESQUISA.md) | Como funcionam Booksy, Fresha, Trinks e Avec + glossário do negócio |
| [docs/ROADMAP.md](docs/ROADMAP.md) | O que está feito e o que falta |
| [ops/README.md](ops/README.md) | Produção: primeira conta, papéis, variáveis, bucket de imagens |
| [ops/backup/README.md](ops/backup/README.md) | Backup diário e prova de restauro |
| [ops/onboarding.md](ops/onboarding.md) | Os dados a pedir a um salão novo, na ordem |

## País não é constante

Moeda, idioma, fuso e formato de telefone saem da variável `PAIS`
(`apps/web/src/lib/pais.ts`). Para o cliente atual é Portugal: euro, `pt-PT`,
`Europe/Lisbon`, telemóvel de nove dígitos.

Todo valor monetário é **inteiro em cêntimos**, em todo o lado. Nunca vírgula flutuante.

## Publicar

O site corre no Railway (Amsterdão) e o banco é um PostgreSQL no Supabase (Frankfurt) —
ADR-009. O deploy é automático a partir da branch `producao`:

```sh
git push origin main
git push origin main:producao
git branch -f producao main
```

`main` é onde o trabalho acontece; `producao` é o que está no ar. O intervalo entre os dois
comandos é a margem de segurança. O `preDeployCommand` corre as migrations e as travas antes
de trocar a versão, portanto um deploy `SUCCESS` já é prova de que o schema aplicou.
