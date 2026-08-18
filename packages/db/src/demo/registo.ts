/**
 * O registo do que a demonstração escreveu — e a borracha que o desfaz.
 *
 * A demonstração corre sobre a base de PRODUÇÃO, por cima do catálogo verdadeiro
 * do salão: 67 serviços, as fotografias, as habilidades da equipa. O `db:seed`
 * não serve para isto, porque começa por truncar o schema inteiro. Aqui só se
 * insere — e, para que só se insira com segurança, tem de existir antes a
 * certeza de conseguir tirar exactamente o que se pôs.
 *
 * Essa certeza não pode ser heurística. «Apagar as clientes com telefone +35190…»
 * ou «apagar as marcações criadas hoje» funciona até ao dia em que não funciona,
 * e o dia em que não funciona é o dia em que apaga uma cliente de verdade. O que
 * fica guardado aqui é a lista dos identificadores, linha a linha, escrita na
 * mesma transacção em que as linhas nascem: se a demonstração falhar a meio,
 * nada foi escrito e não há registo nenhum; se correr, o registo cobre tudo.
 *
 * `ordem` é o número de sequência da inserção. A limpeza apaga as tabelas pela
 * ordem inversa da primeira inserção de cada uma, e isso basta para nunca bater
 * numa chave estrangeira: uma linha filha só pode ter sido inserida depois da
 * mãe, portanto sai sempre primeiro. Não é uma lista de dependências escrita à
 * mão — que envelheceria com o schema —, é uma consequência da ordem real.
 *
 * Nem toda a linha precisa de estar registada: o que desaparece por `cascade` de
 * uma linha registada está garantido à mesma. Registam-se as raízes e o que tem
 * `restrict` pelo caminho. A tabela em si é criada por este script e destruída
 * pela limpeza — nunca entra numa migration, porque não é schema do produto.
 */

import { sql } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/postgres-js'

type Db = ReturnType<typeof drizzle>
/** Aceita tanto a ligação como a transacção — o `tx` do Drizzle tem `execute`. */
type Executor = Pick<Db, 'execute'>

export const TABELA_REGISTO = 'demo_linhas'

export interface LinhaRegistada {
  tabela: string
  linhaId: string
  ordem: number
}

/**
 * O contador que dá a `ordem`. Quem constrói as linhas chama `registar` na mesma
 * sequência em que vai inserir; guardar isto num objecto em vez de numa variável
 * solta é o que impede duas partes do script de partirem a numeração uma da
 * outra sem se notar.
 */
export class Registo {
  private readonly linhas: LinhaRegistada[] = []
  private proxima = 0

  registar(tabela: string, ids: readonly string[]): void {
    for (const linhaId of ids) {
      this.linhas.push({ tabela, linhaId, ordem: this.proxima++ })
    }
  }

  get total(): number {
    return this.linhas.length
  }

  todas(): readonly LinhaRegistada[] {
    return this.linhas
  }
}

export async function criarTabelaDeRegisto(db: Executor): Promise<void> {
  await db.execute(sql`
    create table if not exists ${sql.identifier(TABELA_REGISTO)} (
      tabela   text   not null,
      linha_id uuid   not null,
      ordem    bigint not null,
      primary key (tabela, linha_id)
    )
  `)
}

export async function existeRegisto(db: Executor): Promise<boolean> {
  const linhas = await db.execute<{ existe: string | null }>(
    sql`select to_regclass(${`public.${TABELA_REGISTO}`}) as existe`,
  )
  return [...linhas][0]?.existe != null
}

export async function contarRegisto(db: Executor): Promise<number> {
  const linhas = await db.execute<{ total: number }>(
    sql`select count(*)::int as total from ${sql.identifier(TABELA_REGISTO)}`,
  )
  return [...linhas][0]?.total ?? 0
}

export async function gravarRegisto(db: Executor, registo: Registo): Promise<void> {
  /* Uma linha de `values` por registo daria um comando com 3 × N parâmetros e o
     Postgres corta aos 65535. Em vez de lotes, vão três arrays e o `unnest`
     abre-os em linhas: um comando só, três parâmetros, sem teto prático.

     `sql.param` não é cerimónia: um array solto dentro do template do Drizzle é
     expandido em `(a, b, c)` — uma lista de N parâmetros, que é justamente o que
     se está a evitar, e que além disso não é um array para o `unnest` abrir. */
  const linhas = registo.todas()
  const tabelas = linhas.map((l) => l.tabela)
  const ids = linhas.map((l) => l.linhaId)
  const ordens = linhas.map((l) => l.ordem)
  await db.execute(sql`
    insert into ${sql.identifier(TABELA_REGISTO)} (tabela, linha_id, ordem)
    select * from unnest(
      ${sql.param(tabelas)}::text[],
      ${sql.param(ids)}::uuid[],
      ${sql.param(ordens)}::bigint[]
    )
  `)
}

/* `type` e não `interface`: o `execute` do Drizzle exige que a linha devolvida
   caiba em `Record<string, unknown>`, e só o alias de tipo ganha a assinatura de
   índice implícita que isso pede. */
export type GrupoDoRegisto = {
  tabela: string
  linhas: number
  primeira: number
}

export async function agruparRegisto(db: Executor): Promise<GrupoDoRegisto[]> {
  const linhas = await db.execute<GrupoDoRegisto>(sql`
    select tabela,
           count(*)::int   as linhas,
           min(ordem)::int as primeira
      from ${sql.identifier(TABELA_REGISTO)}
     group by tabela
     order by primeira desc
  `)
  return [...linhas]
}

/**
 * Apaga o que o registo diz, e só isso.
 *
 * O nome da tabela vem da base e entra numa instrução de DELETE, por isso é
 * conferido contra `pg_tables` antes de lá chegar: um nome que não é de tabela
 * real nunca chega ao SQL.
 *
 * Uma tabela do registo que já não existe **não é erro**, é trabalho já feito.
 * Largar a tabela levou as linhas com ela, e é exactamente o que vai acontecer:
 * a demonstração escreveu 736 linhas em `commission_rules` e
 * `commission_entries`, e a migração que retira as comissões larga as duas.
 * Isto já rebentou em cima do que interessa — a limpeza inteira corre numa
 * transacção só, portanto um `throw` aqui fazia rollback e as OUTRAS 2054
 * linhas falsas ficavam de pé na base do salão, sem forma de as apagar por este
 * caminho outra vez. Saltar, dizer que se saltou, e continuar.
 */
export async function apagarPeloRegisto(
  db: Executor,
  grupos: readonly GrupoDoRegisto[],
): Promise<{ tabela: string; apagadas: number; desaparecida?: boolean }[]> {
  const existentes = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  )
  const reais = new Set([...existentes].map((r) => r.tablename))

  const resultado: { tabela: string; apagadas: number; desaparecida?: boolean }[] = []
  for (const grupo of grupos) {
    if (!reais.has(grupo.tabela)) {
      resultado.push({ tabela: grupo.tabela, apagadas: 0, desaparecida: true })
      continue
    }
    const apagadas = await db.execute(sql`
      delete from ${sql.identifier(grupo.tabela)}
       where id in (
         select linha_id from ${sql.identifier(TABELA_REGISTO)} where tabela = ${grupo.tabela}
       )
    `)
    resultado.push({
      tabela: grupo.tabela,
      apagadas: (apagadas as unknown as { count?: number }).count ?? grupo.linhas,
    })
  }
  return resultado
}

export async function largarTabelaDeRegisto(db: Executor): Promise<void> {
  await db.execute(sql`drop table ${sql.identifier(TABELA_REGISTO)}`)
}
