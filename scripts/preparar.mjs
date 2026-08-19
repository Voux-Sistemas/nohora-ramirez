/**
 * Do clone ao site a correr, num comando.
 *
 * O CONTRIBUIR.md pedia seis comandos por uma ordem que não se adivinha, e
 * cada um deles falha de maneira diferente se o anterior não tiver corrido:
 * a migração morre se o Postgres ainda está a arrancar, o seed morre se o
 * `.env` não existe, e o `next dev` arranca e só se parte na primeira consulta.
 * Quem chega ao projecto não devia ter de aprender essa ordem — devia escrever
 * `npm run preparar` e ir buscar um café.
 *
 * Corre sem dependências: só `node:` e o que a máquina já tem. É por isso que
 * funciona logo a seguir ao clone, antes de haver `node_modules`.
 *
 * Correr outra vez não estraga nada. O `.env` que já existe fica como está, o
 * contentor que já está de pé continua de pé, e a migração salta o que já
 * aplicou. Só o seed reescreve — e é isso que ele serve para fazer.
 */
import { execSync, execFileSync } from 'node:child_process'
import { existsSync, copyFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const ENV = join(RAIZ, '.env')
const EXEMPLO = join(RAIZ, '.env.example')

/**
 * Bancos onde o seed pode correr — fora desta lista, ele não corre.
 *
 * `banco` é o nome do serviço no docker-compose: é assim que o Codespace vê o
 * Postgres, de contentor para contentor, sem passar por localhost nenhum.
 */
const LOCAIS = new Set(['localhost', '127.0.0.1', '::1', 'banco', 'host.docker.internal'])

/** Anfitriões que somos nós a levantar. Os outros já vêm de pé. */
const NOSSOS = new Set(['localhost', '127.0.0.1', '::1'])

let passo = 0

function anunciar(texto) {
  passo += 1
  console.log(`\n\u001b[1m${passo}. ${texto}\u001b[0m`)
}

function correr(comando, opcoes = {}) {
  execSync(comando, { cwd: RAIZ, stdio: 'inherit', ...opcoes })
}

/** Erro que já traz a saída escrita para quem o lê — não um stack trace. */
function desistir(titulo, ...linhas) {
  console.error(`\n\u001b[31m✗ ${titulo}\u001b[0m`)
  for (const linha of linhas) console.error(`  ${linha}`)
  process.exit(1)
}

function existe(comando) {
  try {
    execSync(comando, { cwd: RAIZ, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// ── 1. A versão do Node ────────────────────────────────────────────────────
// Antes de tudo o resto, porque um Node velho falha lá à frente com um erro de
// sintaxe dentro de uma dependência, e ninguém liga as duas coisas.
anunciar('A conferir o Node')
const maior = Number(process.versions.node.split('.')[0])
if (maior < 20) {
  desistir(
    `Este projecto precisa de Node 20 ou mais novo, e esta máquina tem a ${process.versions.node}.`,
    'O ficheiro .nvmrc pede a 22. Com o nvm instalado: nvm install && nvm use',
  )
}
console.log(`   Node ${process.versions.node} serve.`)

// ── 2. O ficheiro de ambiente ──────────────────────────────────────────────
// Nunca por cima de um que já exista: pode ser o dele, apontado a outro sítio,
// e reescrevê-lo em silêncio seria a pior maneira de o descobrir.
anunciar('O ficheiro .env')
if (existsSync(ENV)) {
  console.log('   Já existe — fica como está.')
} else {
  copyFileSync(EXEMPLO, ENV)
  console.log('   Copiado do .env.example. Já vem apontado ao banco do docker.')
}

const ambiente = readFileSync(ENV, 'utf8')
const linhaUrl = ambiente.match(/^DATABASE_URL=(.*)$/m)
const url = linhaUrl ? linhaUrl[1].trim().replace(/^["']|["']$/g, '') : ''
if (url === '') {
  desistir(
    'O .env existe mas não tem DATABASE_URL.',
    'Se é um .env seu, preencha-o. Para partir do zero: apague o .env e corra outra vez.',
  )
}

let anfitriao = ''
try {
  anfitriao = new URL(url).hostname
} catch {
  desistir('A DATABASE_URL do .env não é um endereço válido.')
}
const eLocal = LOCAIS.has(anfitriao)

// ── 3. As dependências ─────────────────────────────────────────────────────
anunciar('As dependências')
if (existsSync(join(RAIZ, 'node_modules'))) {
  console.log('   node_modules já está montado — a saltar o npm install.')
} else {
  correr('npm install')
}

// ── Um banco que não é de casa não se toca ───────────────────────
// Quem aponta o .env para fora — um banco partilhado, o de produção — não quer
// que um comando de arranque lhe corra migrações. É aqui que o guarda-freio está,
// e não num aviso escrito num documento que se lê depois do estrago.
if (!eLocal) {
  console.log(`
[33m⚠ A DATABASE_URL aponta para "${anfitriao}", que não é um banco desta máquina.[0m

  Fico por aqui: não levanto contentor, não migro e não semeio um banco que não
  é de teste — o seed esvazia as tabelas todas antes de escrever.

  Para montar o ambiente de casa: apague ou renomeie o .env e corra outra vez.
  Se sabe o que está a fazer e quer mesmo migrar esse banco: npm run db:migrate
`)
  process.exit(0)
}

// ── 4. O Postgres ─────────────────────────────────────────
anunciar('O Postgres')
if (!NOSSOS.has(anfitriao)) {
  // Codespace, ou qualquer outro sítio onde o banco vive noutro contentor: não
  // há docker cá dentro para levantar, e não é preciso — ele já está de pé.
  console.log(`   Já está de pé em "${anfitriao}" — não tenho nada a levantar.`)
} else if (!existe('docker compose version')) {
  desistir(
    'O Docker não responde.',
    'Instale o Docker Desktop (https://docker.com/products/docker-desktop), abra-o,',
    'e corra outra vez. No Windows: winget install Docker.DockerDesktop',
    '',
    'Alternativa sem instalar nada: abra o repositório num GitHub Codespace,',
    'onde isto tudo já acontece sozinho.',
  )
} else {
  // `--wait` e não `up -d` seco: o healthcheck do compose é o que evita a
  // migração falhar contra um Postgres que ainda está a arrancar.
  correr('docker compose up -d --wait')
}

// ── 5. O schema ──────────────────────────────────────────
anunciar('O schema e as travas anti-overbooking')
correr('npm run db:migrate')

// ── 6. O salão de mentira ──────────────────────────────────
anunciar('O salão de demonstração')
correr('npm run db:seed')

// ── Fim ──────────────────────────────────────────────
console.log(`
[32m✓ Pronto.[0m

  npm run dev          e o site fica em http://localhost:3000

A primeira conta faz-se em http://localhost:3000/comecar, com o código
"instalar-local" que já vem no .env. Dali para a frente entra-se com telemóvel
e senha, e a porta do /comecar fecha-se sozinha.

Antes de empurrar trabalho, os portões:

  rm -rf apps/web/.next/types && npm run typecheck && npm run lint && npm test

As armadilhas que custaram caro estão no CONTRIBUIR.md. Vale os cinco minutos.
`)
