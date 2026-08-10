import 'server-only'

/**
 * A primeira conta.
 *
 * Sistema recém-instalado tem um problema de galinha e ovo: só quem já entrou
 * consegue criar quem entra. `/admin` exige sessão de equipe, senha só se define
 * dentro de `/admin/equipe`, e o banco novo não tem ninguém. Sem uma porta de
 * instalação o sistema sobe correto e inacessível — que foi exatamente o estado
 * em que a produção subiu.
 *
 * Esta é essa porta, e ela é estreita de propósito:
 *
 * 1. só abre enquanto **nenhuma** conta de equipe existir. A primeira conta
 *    criada fecha a porta, sem depender de alguém lembrar de fechar depois;
 * 2. e exige o código de instalação, que vive em variável de ambiente. Sem a
 *    variável, a porta está fechada — o padrão é fechado, como em `ambiente.ts`.
 *
 * A condição (1) sozinha não bastaria. Entre o deploy e o primeiro login existe
 * uma janela em que o endereço já é público, e quem chegasse nela primeiro
 * viraria dono do salão.
 */

import { userRoles, users } from '@studio/db'
import { eq, ne } from 'drizzle-orm'
import { timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { hashSecret, sha256Hex } from './crypto'
import { createSession } from './session'

/** Vale para `db` e para a transação — a pergunta é a mesma nos dois. */
type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

function codigoEsperado(): string | null {
  const codigo = process.env.CODIGO_INSTALACAO?.trim()
  return codigo ? codigo : null
}

/**
 * Comparação que não conta pelo relógio quantos caracteres estavam certos.
 *
 * Os dois lados passam pelo sha256 antes: `timingSafeEqual` recusa buffers de
 * tamanhos diferentes, e recusar cedo por tamanho já seria, sozinho, entregar o
 * tamanho do código. Depois do hash os dois têm sempre 32 bytes.
 */
function mesmoCodigo(recebido: string, esperado: string): boolean {
  return timingSafeEqual(
    Buffer.from(sha256Hex(recebido), 'hex'),
    Buffer.from(sha256Hex(esperado), 'hex'),
  )
}

async function existeEquipe(exec: Executor): Promise<boolean> {
  const [linha] = await exec
    .select({ id: userRoles.id })
    .from(userRoles)
    .where(ne(userRoles.role, 'client'))
    .limit(1)
  return Boolean(linha)
}

/** Se a tela de instalação deve existir nesta requisição. */
export async function instalacaoAberta(): Promise<boolean> {
  if (!codigoEsperado()) return false
  return !(await existeEquipe(db))
}

export interface InstalacaoResult {
  ok: boolean
  message?: string
}

/**
 * Cria a conta da dona com papel de rede (`unitId` nulo = enxerga tudo) e já
 * abre a sessão — quem acabou de provar o código não precisa provar de novo na
 * tela seguinte.
 */
export async function criarPrimeiraConta(input: {
  nome: string
  /** E.164. */
  phone: string
  /** Obrigatório aqui, ao contrário do resto do sistema: é a única saída se
      esta senha se perder. Não há conta acima desta para redefini-la. */
  email: string
  senha: string
  codigo: string
}): Promise<InstalacaoResult> {
  const esperado = codigoEsperado()
  if (!esperado) return { ok: false, message: 'Instalação fechada.' }
  if (!mesmoCodigo(input.codigo, esperado)) {
    return { ok: false, message: 'Código de instalação incorreto.' }
  }

  const passwordHash = await hashSecret(input.senha)

  const userId = await db.transaction(async (tx) => {
    // Confere de novo aqui dentro. A tela decide o que mostrar; quem decide o
    // que grava é a transação, e entre uma coisa e outra o mundo pode ter mudado.
    if (await existeEquipe(tx)) return null

    const [existente] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, input.phone))
      .limit(1)

    // O telefone pode já estar no banco como cliente: a dona que marcou o
    // próprio horário para testar é o caso comum, não a exceção. Aproveita a
    // pessoa em vez de criar uma segunda com o mesmo número.
    if (existente) {
      await tx
        .update(users)
        .set({ name: input.nome, email: input.email, passwordHash, status: 'active' })
        .where(eq(users.id, existente.id))
    }

    const id =
      existente?.id ??
      (
        await tx
          .insert(users)
          .values({ phone: input.phone, name: input.nome, email: input.email, passwordHash })
          .returning({ id: users.id })
      )[0]!.id

    await tx.insert(userRoles).values({ userId: id, role: 'owner' }).onConflictDoNothing()
    return id
  })

  if (!userId) {
    return { ok: false, message: 'Este sistema já tem uma conta de equipe. Entre pela tela de login.' }
  }

  await createSession(userId)
  return { ok: true }
}
