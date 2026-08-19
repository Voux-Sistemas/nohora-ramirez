# Entrar no projecto

Este ficheiro é para quem chega agora ao código. Não repete o [README](README.md)
— diz o que não se descobre a ler o repositório, e o que já custou caro a
descobrir por acidente.

---

## Do zero até ver o site

### Sem instalar nada, e sem escrever nada

No GitHub: botão verde **Code** → separador **Codespaces** → **Create codespace**.

É só isso. O `.devcontainer/` que está no repositório trata do resto — levanta o
Postgres, cria o `.env`, instala as dependências, migra o schema com as travas,
semeia o salão de demonstração inteiro e arranca o servidor. Quando a porta 3000
responder, o VS Code abre o site num separador. A primeira vez leva uns minutos,
porque monta a máquina toda; a partir daí é abrir e continuar de onde se ficou.

O mesmo `.devcontainer/` serve o VS Code de casa: com o Docker Desktop aberto,
**Reopen in Container**, e acontece exactamente a mesma coisa.

### Na sua própria máquina

Precisa de **Node 22** (está em `.nvmrc`; com `nvm`, basta `nvm use`) e do
**Docker**.

```sh
git clone https://github.com/Voux-Sistemas/nohora-ramirez.git
cd nohora-ramirez

npm run preparar     # .env, dependências, Postgres, schema, salão fictício
npm run dev          # http://localhost:3000
```

O `npm run preparar` (`scripts/preparar.mjs`) é o mesmo que o Codespace corre, e
faz os seis passos por ordem, explicando cada um. Correr outra vez não estraga
nada: o `.env` que já existe fica como está, o contentor que já está de pé
continua de pé, e a migração salta o que já aplicou.

O `.env.example` e o `docker-compose.yml` estão combinados de propósito: a
`DATABASE_URL` que vem no ficheiro é a do contentor. Copiar e correr, sem editar
nada.

O seed monta um salão inventado completo — catálogo, equipa, escalas, marcações.
**É sobre ele que se desenvolve.** Não é preciso, e não se deve, tocar em dado de
cliente verdadeiro para trabalhar.

**O seed não cria contas** — cria o salão, não quem entra nele. A primeira conta
faz-se em <http://localhost:3000/comecar>, com o código `instalar-local` que já
vem no `.env.example`. A partir daí o login da equipa é **telemóvel + senha**,
nunca e-mail, e a porta do `/comecar` fecha-se sozinha — a segunda conta cria-se
por dentro, em `/admin/equipe`.

Recomeçar do zero quando o banco ficar torto:

```sh
docker compose down -v && docker compose up -d --wait
npm run db:migrate && npm run db:seed
```

---

## O que publica, e o que não publica

| Branch | O que acontece ao empurrar |
|---|---|
| `main` | **nada.** É onde o trabalho se junta. |
| `producao` | **a Railway constrói e publica no site do salão, à vista das clientes.** |

Publicar é sempre dois passos, nesta ordem, e o segundo é uma decisão tomada em
conjunto — não um detalhe do primeiro:

```sh
git push origin main
git push origin main:producao     # isto vai para o ar
```

Não há revisão automática a segurar o erro: o CI (`.github/workflows/ci.yml`)
está em `workflow_dispatch` porque a organização ainda não tem forma de
pagamento cadastrada, e o GitHub enfileira o job sem nunca lhe dar máquina. Até
lá, **os quatro comandos correm-se à mão antes de empurrar**:

```sh
rm -rf apps/web/.next/types      # ver a armadilha nº 3
npm run typecheck
npm run lint
npm test
npm run build
```

---

## As armadilhas, por ordem do estrago que fazem

**1. Nunca apontar o `.env` local para o banco de produção.** Não é só o risco
de escrever por cima da agenda do salão: o pooler de sessão da Supabase abre
**quinze ligações no total**, o site pede cinco por processo, e a Railway
sobrepõe dois contentores durante o deploy. Um `next dev` local ligado ao banco
verdadeiro come o resto e a montra responde 500 às clientes. Já aconteceu, a
2026-08-18.

**2. Nunca correr `npm run db:seed` contra o banco do salão.** O seed começa por
esvaziar todas as tabelas. Há uma trava dentro do próprio banco
(`deployment_env`, em `packages/db/sql/02_ambiente.sql`) e ela **rebenta** quando
a marca é `producao` — mas só *avisa* quando a marca não existe de todo. Uma
marca em falta não é protecção. Há uma segunda trava, essa antes de qualquer
ligação: o `npm run preparar` lê o anfitrião da `DATABASE_URL` e recusa-se a
migrar ou semear tudo o que não seja `localhost`, `127.0.0.1` ou o contentor
`banco`. Chamar o `db:seed` à mão contorna-a — e é por isso que continua a ser a
armadilha número dois.

**3. `apps/web/.next/types` em cache parte o `tsc` sem dizer porquê.** Os tipos
de rota do Next ficam velhos e o typecheck acusa erros em ficheiros que estão
certos. `rm -rf apps/web/.next/types` antes de typecheck, sempre.

**4. Nunca `npx prettier --write` neste repositório.** Não há configuração de
Prettier, e o padrão dele desfaz o estilo do código todo num commit ilegível.
Formatação é ESLint e mais nada.

**5. Não converter finais de linha em massa.** Há ficheiros em CRLF e ficheiros
em LF, e é assim que estão versionados. Um `dos2unix` recursivo transforma um
commit de três linhas num commit de trinta mil.

**6. `git fetch` antes de começar trabalho grande.** Somos dois a mexer no mesmo
repositório e já houve um conflito de estrutura em `main` que custou uma tarde a
desfazer. Trabalho grande em branch própria, e juntar cedo em vez de tarde.

---

## Regras do código que não se negoceiam

- **Dinheiro é sempre inteiro em cêntimos**, em todo o lado, do banco ao ecrã.
  Nunca vírgula flutuante. `15,00 €` são `1500`.
- **País não é constante.** Moeda, idioma, fuso e formato de telefone saem da
  variável `PAIS` (`apps/web/src/lib/pais.ts`). O cliente actual é **Portugal**:
  euro, `pt-PT`, `Europe/Lisbon`, telemóvel de nove dígitos. Nada de `R$`, nada
  de `pt-BR`, nada de CEP.
- **A regra de negócio vive em `packages/core`**, sem Next e sem ORM, para se
  poder testar sem subir servidor nem banco (ADR-007). Disponibilidade, preço e
  fuso não descem para dentro de um componente.
- **O desenho tem sistema, e está escrito.** Antes de inventar um componente ou
  uma cor, ler o [DESIGN.md](DESIGN.md) — inclusive a lista do que ele recusa.
- **Toda a decisão técnica com consequência fica em
  [docs/DECISOES.md](docs/DECISOES.md)**, com data e motivo. Não se apaga uma
  decisão; revoga-se, e diz-se porquê.

---

## Dados verdadeiros: o que é do salão e não é nosso

- `material/` são as **fotografias reais das duas lojas** e o logo, que a dona
  mandou. Estão no repositório porque o site precisa delas. Não se republicam
  noutro lado e não se substituem por imagens de banco.
- `dados/real/` está fora do Git e é onde moram os CSVs com nomes, telemóveis e
  e-mails de clientes verdadeiras. **Nunca entra num commit** — nem "só para
  testar", porque um histórico empurrado não se desfaz.
- Os dez `dados/*.csv` versionados são o **modelo do formato**, com um salão
  inventado. É desses que se parte.

---

## Onde ler o resto

O [README](README.md) tem o mapa dos documentos todos. Os três que valem a
primeira hora: [PRODUCT.md](PRODUCT.md) (o que o produto é e o que não pode ser
inventado), [DESIGN.md](DESIGN.md) (o sistema visual) e
[docs/ARQUITETURA.md](docs/ARQUITETURA.md) (stack, motor de disponibilidade,
autenticação).
