# Como ver o sistema a correr

Cinco comandos, depois de uma coisa só: **a ligação a um Postgres.**

Tudo o resto já está pronto nesta máquina — as dependências estão instaladas e
o `.env` da raiz já está criado com todas as outras variáveis preenchidas.

---

## 1. Arranjar um Postgres

Não há Docker nem Postgres instalado aqui, então o banco tem de vir de fora.

### O caminho que funciona sempre: um banco novo, grátis

[**neon.tech**](https://neon.tech) — dois minutos, sem cartão:
*New project* → copiar a **Connection string**.

(Alternativa equivalente: [supabase.com](https://supabase.com) → New project →
Settings → Database → Connection string, modo **Session**.)

### Sobre o Railway

O Postgres de produção do salão **não é alcançável da sua máquina** — não há
proxy TCP publicado (está escrito em `packages/db/src/cadastro/nohora.ts`).
Para chegar lá seria preciso ligar o *TCP Proxy* nas definições do serviço, e
aí estaria a mexer no **banco real do salão**. Para só ver o sistema, não vale
a pena: use o Neon.

### Colar

Abra o `.env` na raiz e ponha o valor entre as aspas:

```
DATABASE_URL="postgresql://…"
```

---

## 2. Criar as tabelas

```bash
npm run db:migrate
```

---

## 3. Pôr dados dentro

Há dois conjuntos, e eles servem para coisas diferentes.

### A — o salão real (recomendado)

As duas casas verdadeiras — Valongo e Maia —, as nove fotografias que a dona
mandou e o preçário dela. É o que combina com `PAIS="PT"` no `.env`.

```bash
npm run cadastro --workspace=@studio/db             # as casas, as fotos e o preçário
npm run equipe-temporaria --workspace=@studio/db    # uma profissional por loja, para haver horário livre
npm run dona-temporaria --workspace=@studio/db      # a conta de gestão
```

O segundo é obrigatório para ver a marcação funcionar: um serviço só aparece
para marcar se alguém daquela loja souber fazê-lo. Sem ele, `/marcar` diz
*"esta casa ainda não tem serviços abertos"* — que é a verdade.

### B — a demonstração

Três lojas fictícias em São Paulo, com a agenda cheia de visitas ao longo do
mês. Útil para ver a grade do dia e a agenda de semana/mês com volume real.

```bash
npm run db:seed
```

⚠️ O `db:seed` cria as pessoas **sem senha** — dá para navegar o lado da
cliente, mas não dá para entrar no painel. Corra o `dona-temporaria` a seguir
se quiser as duas coisas.

---

## 4. Subir

```bash
npm run dev
```

→ **http://localhost:3000**

---

## 5. Por onde andar

### O lado da cliente — não precisa de login nenhum

| | |
|---|---|
| `/` | a página: capa, as casas, o preçário da rede |
| `/casa/valongo` | a casa: morada, horário, fotografias, preçário dela |
| **`/marcar`** | **a marcação inteira numa tela** |
| `/minha-conta` | próximas visitas e histórico (aí sim, precisa de sessão) |

O caminho que mostra o que mudou: abrir `/`, carregar em **Marcar horário** e ir
até ao fim. Repare que dá para voltar a qualquer passo pela trilha em cima sem
perder nada, e que o extrato à direita vai-se formando.

### O lado da equipa — `/entrar/equipa`

Depois do `dona-temporaria`, entre com:

| | |
|---|---|
| telemóvel | `900 000 003` |
| senha | `dona-teste-2026` |

| | |
|---|---|
| `/painel` | **Hoje** — a grade do dia, uma coluna por profissional |
| **`/painel/agenda`** | **a agenda de uma pessoa: dia · semana · mês** ← o que não existia |
| `/painel/clientes` · `/painel/caixa` · `/painel/avisos` | a operação |
| `/painel/gestao` | casas, catálogo, equipa, recursos, comissões |

Duas coisas para reparar:

1. O **selector de casa** no cabeçalho. Troque de loja numa secção e vá para
   outra — ela acompanha. Antes, cada secção tinha a sua própria tela de
   "escolha a unidade", e trocar de secção perdia a escolha.
2. Em `/painel/agenda`, os três botões **Dia · Semana · Mês**, e o selector de
   pessoa ao lado do título. A semana e o mês são novos: a profissional que
   quisesse ver a semana dela abria a grade da recepção sete vezes.

> A agenda só tem o que mostrar se houver visitas marcadas. Com o conjunto A
> (salão real) a agenda nasce vazia — marque duas ou três por `/marcar` e volte
> ao painel. Com o conjunto B a agenda já vem cheia.

---

## Se der erro

| O que aparece | O que é |
|---|---|
| `DATABASE_URL não definida` | o `.env` está vazio — passo 1 |
| `ECONNREFUSED` · `getaddrinfo ENOTFOUND` | a string está errada, ou é a interna do Railway (`.railway.internal`), que só resolve de dentro da rede deles |
| `relation "units" does not exist` | falta o `npm run db:migrate` |
| `password authentication failed` | a senha na string tem caracteres que precisam de escape de URL |
| `/marcar` diz *"esta casa ainda não tem serviços abertos"* | falta o `equipe-temporaria` |
| O login da equipa recusa | com só o `db:seed` não há senha nenhuma — corra o `dona-temporaria` |
