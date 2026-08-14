import 'server-only'

/**
 * Quem pode o quê.
 *
 * Até aqui o sistema tinha um degrau só: ou a pessoa era cliente, ou era
 * equipe — e quem era equipe via tudo. Num salão em que a dona e a cabeleireira
 * trabalham lado a lado isso não incomoda. Em três unidades, com gerente e uma
 * equipe que entra e sai, incomoda: a profissional que entra para ver o próprio
 * dia enxerga o caixa da rede, o telefone de todas as clientes e o cadastro.
 *
 * São quatro degraus, e eles vêm de duas perguntas independentes:
 *
 * - **até onde** a pessoa enxerga: uma unidade, algumas, ou a rede inteira;
 * - **o quanto** ela decide: só a própria agenda, a operação de uma loja, o
 *   cadastro da rede, ou a forma da instalação.
 *
 * | Papel | Enxerga | Decide |
 * | --- | --- | --- |
 * | `suporte` | a rede | tudo, mais o que define a instalação |
 * | `dona` | a rede | tudo, inclusive o catálogo e as unidades |
 * | `gerente` | as unidades dela | a operação e a equipe dessas unidades |
 * | `profissional` | a própria agenda | o próprio atendimento |
 *
 * **`suporte` não mora no banco.** É quem instalou e mantém o sistema, não
 * alguém do salão, e por isso não sai de `user_roles`: sai de
 * `TELEFONES_SUPORTE`, uma variável de ambiente. A diferença é o ponto —
 * qualquer degrau que morasse no banco poderia ser dado por quem já tem o
 * cadastro na mão; este só se concede no painel da hospedagem, que é nosso.
 * Não é porta de entrada: quem está na lista continua precisando de um papel de
 * equipe para entrar; a variável eleva, não autentica.
 *
 * Com a variável vazia ninguém é suporte, e as telas que dependem dela ficam
 * fechadas para todo mundo. É de propósito: o custo de esquecer de preencher é
 * um telefonema para nós, não um salão com a instalação aberta.
 *
 * **O padrão é fechado.** Um papel que este arquivo não reconhece não vira
 * acesso nenhum — `receptionist` e `finance` existem no enum do banco desde o
 * começo e nunca foram implementados, então hoje eles não abrem porta alguma.
 * Reconhecer por engano seria dar acesso total a quem ninguém decidiu dar; o
 * caminho certo, quando esses papéis existirem, é entrar nesta tabela de
 * propósito. Está anotado em `ops/README.md` para não virar surpresa.
 */

import { staffUnits } from '@studio/db'
import { eq } from 'drizzle-orm'
import type { Route } from 'next'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { toE164 } from '@/lib/format'
import { getSession, type SessionUser } from './session'

export type Papel = 'suporte' | 'dona' | 'gerente' | 'profissional'

/** Papel de `user_roles` → degrau, do mais forte para o mais fraco. */
const DEGRAUS: readonly { role: string; papel: Papel }[] = [
  { role: 'owner', papel: 'dona' },
  { role: 'unit_manager', papel: 'gerente' },
  { role: 'professional', papel: 'profissional' },
]

/**
 * Os telemóveis de quem mantém a instalação, separados por vírgula.
 *
 * Cada entrada passa pelo mesmo `toE164` que normaliza o número no cadastro,
 * portanto escreve-se na variável como se escreve em qualquer campo do
 * sistema: `+351912345678`, `912345678` ou `912 345 678` chegam todos ao mesmo
 * sítio. Antes daqui a comparação era de dígitos crus com um piso de dez, e um
 * telemóvel português — que tem nove — era descartado em silêncio: a variável
 * ficava preenchida, o acesso de suporte nunca aparecia, e não havia erro
 * nenhum a apontar para a causa.
 *
 * Lida a cada chamada porque em produção a variável só muda com redeploy — e
 * ler na hora evita um valor congelado no build de quem correr isto de outro
 * jeito.
 */
function telefonesDeSuporte(): Set<string> {
  const bruto = process.env.TELEFONES_SUPORTE ?? ''
  const numeros = new Set<string>()
  for (const item of bruto.split(',')) {
    const e164 = toE164(item.trim())
    if (e164) numeros.add(e164)
  }
  return numeros
}

function ehSuporte(phone: string): boolean {
  return telefonesDeSuporte().has(phone)
}

export interface Acesso {
  session: SessionUser
  papel: Papel
  /**
   * As unidades que esta pessoa enxerga. `null` é a rede inteira — e é
   * diferente de uma lista vazia, que é "nenhuma". A distinção importa:
   * confundir as duas dá acesso a tudo para quem não tem unidade nenhuma.
   */
  unidadeIds: readonly string[] | null
  /** Perfil de agenda, quando a pessoa também atende. */
  staffId: string | null
}

/**
 * Junta as linhas de `user_roles` de um mesmo papel numa só resposta de escopo.
 * Linha com `unit_id` nulo é escopo de rede e vence as demais — é assim que a
 * dona enxerga tudo sem precisar de uma linha por unidade.
 */
function escopoDe(
  roles: readonly { role: string; unitId: string | null }[],
  nome: string,
): { tem: boolean; unidades: string[] | null } {
  const linhas = roles.filter((row) => row.role === nome)
  if (linhas.length === 0) return { tem: false, unidades: [] }
  if (linhas.some((row) => row.unitId === null)) return { tem: true, unidades: null }
  return { tem: true, unidades: linhas.map((row) => row.unitId as string) }
}

/**
 * O degrau desta sessão, ou `null` se ela não tem nenhum reconhecido.
 *
 * Quem acumula papéis fica com o mais forte: a dona que também atende continua
 * dona, e ainda assim aparece como coluna na agenda pelo `staffId`.
 */
export async function acessoDe(session: SessionUser): Promise<Acesso | null> {
  for (const degrau of DEGRAUS) {
    const escopo = escopoDe(session.roles, degrau.role)
    if (!escopo.tem) continue

    if (degrau.papel !== 'profissional') {
      /* Quem mantém a instalação sobe um degrau acima da dona, e enxerga a rede
         inteira mesmo que o papel dela no banco seja de uma loja só. */
      const suporte = ehSuporte(session.phone)
      return {
        session,
        papel: suporte ? 'suporte' : degrau.papel,
        unidadeIds: suporte ? null : escopo.unidades,
        staffId: session.staffId,
      }
    }

    /*
      A profissional é a única cujo escopo não vem de `user_roles`: o cadastro
      grava o papel sem unidade, e onde ela atende é `staff_units` — a mesma
      tabela que a agenda usa para montar as colunas. Ler de outro lugar seria
      abrir a porta de uma loja em que ela não trabalha.
    */
    if (!session.staffId) return null
    const rows = await db
      .select({ unitId: staffUnits.unitId })
      .from(staffUnits)
      .where(eq(staffUnits.staffId, session.staffId))

    return {
      session,
      papel: 'profissional',
      unidadeIds: rows.map((row) => row.unitId),
      staffId: session.staffId,
    }
  }

  return null
}

/** Só para o login: se este telefone tem algum degrau de equipe. */
export function temPapelDeEquipe(roles: readonly { role: string }[]): boolean {
  return roles.some((row) => DEGRAUS.some((degrau) => degrau.role === row.role))
}

// ─── perguntas ──────────────────────────────────────────────────────────────

/** Manda na operação de uma loja: agenda alheia, caixa, clientes, avisos. */
export function podeGerir(acesso: Acesso): boolean {
  return acesso.papel !== 'profissional'
}

/** Mexe no que é da rede: unidades, catálogo de serviços, regras de comissão. */
export function podeRede(acesso: Acesso): boolean {
  return acesso.papel === 'dona' || acesso.papel === 'suporte'
}

/**
 * Mexe no que define a instalação, e não no que o salão opera: abrir uma loja
 * nova, mudar o endereço público dela, inventar um tipo de recurso e dar acesso
 * de dona a alguém. São decisões que o salão pede e nós executamos — desfazer
 * qualquer uma delas custa mais caro do que fazer.
 */
export function podeSuporte(acesso: Acesso): boolean {
  return acesso.papel === 'suporte'
}

export function veUnidade(acesso: Acesso, unitId: string): boolean {
  return acesso.unidadeIds === null || acesso.unidadeIds.includes(unitId)
}

/** Recorta uma lista de unidades para o que esta pessoa pode ver. */
export function unidadesVisiveis<T extends { id: string }>(
  acesso: Acesso,
  lista: readonly T[],
): T[] {
  return acesso.unidadeIds === null ? [...lista] : lista.filter((item) => veUnidade(acesso, item.id))
}

/**
 * A tela inicial de cada degrau.
 *
 * Para a profissional o início é a agenda: "Hoje na rede" mostra o caixa das
 * três lojas, que não é dela. Mandar para cá também é o destino de quem tenta
 * abrir uma tela que não lhe cabe — sair no próprio começo é menos confuso do
 * que um erro.
 */
export function inicio(acesso: Acesso): Route {
  return acesso.papel === 'profissional' ? '/agenda' : '/'
}

// ─── porteiros de tela ──────────────────────────────────────────────────────

export async function requireAcesso(): Promise<Acesso> {
  const session = await getSession()
  if (!session) redirect('/entrar')
  const acesso = await acessoDe(session)
  if (!acesso) redirect('/entrar')
  return acesso
}

export async function requireGestao(): Promise<Acesso> {
  const acesso = await requireAcesso()
  if (!podeGerir(acesso)) redirect(inicio(acesso))
  return acesso
}

export async function requireRede(): Promise<Acesso> {
  const acesso = await requireAcesso()
  if (!podeRede(acesso)) redirect(inicio(acesso))
  return acesso
}

export async function requireSuporte(): Promise<Acesso> {
  const acesso = await requireAcesso()
  if (!podeSuporte(acesso)) redirect(inicio(acesso))
  return acesso
}

/**
 * `notFound`, e não um "sem permissão": para quem não trabalha nela, a unidade
 * simplesmente não existe. Uma mensagem de acesso negado confirmaria o endereço
 * e o nome da loja para quem só estava chutando slug.
 */
export function requireUnidade(acesso: Acesso, unitId: string): void {
  if (!veUnidade(acesso, unitId)) notFound()
}

// ─── porteiros de ação ──────────────────────────────────────────────────────

/*
  Server action não redireciona: ela grava. Aqui o certo é parar com erro — a
  tela que chamou já tinha escondido o botão, então chegar neste ponto é
  requisição forjada, não engano de navegação.
*/

const NEGADO = 'sem permissão para esta ação'

/* Aqui a mensagem é diferente de propósito: não é engano nem invasão, é uma
   decisão que a dona legitimamente quer e que passa por nós. Dizer "sem
   permissão" faria ela achar que quebrou alguma coisa. */
const NEGADO_SUPORTE = 'esta mudança é feita pelo suporte — fale com quem instalou o sistema'

export async function assertGestao(): Promise<Acesso> {
  const acesso = await requireAcesso()
  if (!podeGerir(acesso)) throw new Error(NEGADO)
  return acesso
}

export async function assertRede(): Promise<Acesso> {
  const acesso = await requireAcesso()
  if (!podeRede(acesso)) throw new Error(NEGADO)
  return acesso
}

export async function assertSuporte(): Promise<Acesso> {
  const acesso = await requireAcesso()
  if (!podeSuporte(acesso)) throw new Error(NEGADO_SUPORTE)
  return acesso
}

/** Gestão **e** dentro do alcance: o gerente do Centro não mexe no Jardins. */
export async function assertUnidade(unitId: string): Promise<Acesso> {
  const acesso = await assertGestao()
  if (!veUnidade(acesso, unitId)) throw new Error(NEGADO)
  return acesso
}
