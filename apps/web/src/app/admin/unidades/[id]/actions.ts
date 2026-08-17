'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  addUnitException,
  addUnitPhotos,
  createUnit,
  getUnitAdmin,
  getUnitImage,
  moveUnitPhoto,
  removeUnitException,
  removeUnitPhoto,
  replaceUnitHours,
  setUnitImage,
  updateUnit,
  updateUnitPhotoAlt,
  type HoursInput,
  type UnitInput,
} from '@/server/admin/units'
import { type EstadoDeFormulario } from '@/components/ui/erro-do-form'
import { pais } from '@/lib/pais'
import { assertRede, assertSuporte, podeSuporte } from '@/server/auth/permissoes'
import { mensagemDoErro } from '@/server/erros'
import { recusaDaImagem, resolveImageField } from '@/server/storage/form'
import { discardImage, storeUploadedImages, UploadError } from '@/server/storage/images'

/*
  Unidade é da rede: nome, endereço, horário de funcionamento e as regras que a
  agenda da loja inteira obedece. Só a dona. As três ações conferem por conta
  própria porque nenhuma tela protege um endereço HTTP.

  Duas coisas ficam um degrau acima, no suporte: abrir uma loja nova e mudar o
  slug. Loja nova mexe em cobrança e em tudo que pendura em unidade; o slug é o
  endereço que o salão já imprimiu em cartão e colocou no Instagram, e trocar
  quebra o link antigo em silêncio.
*/

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

/* Para a recusa dizer o dia, e não "linha 4". */
const DIA = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
]

function parseUnit(formData: FormData): UnitInput {
  return {
    name: String(formData.get('name') ?? '').trim(),
    slug: String(formData.get('slug') ?? '').trim(),
    phone: String(formData.get('phone') ?? '').trim() || undefined,
    email: String(formData.get('email') ?? '').trim() || undefined,
    addressLine: String(formData.get('addressLine') ?? '').trim() || undefined,
    district: String(formData.get('district') ?? '').trim() || undefined,
    city: String(formData.get('city') ?? '').trim() || undefined,
    state: String(formData.get('state') ?? '').trim() || undefined,
    postalCode: String(formData.get('postalCode') ?? '').trim() || undefined,
    timezone: String(formData.get('timezone') ?? '').trim() || pais().fusoPadrao,
    active: formData.get('active') === 'on',
    settings: {
      minLeadMin: Number(formData.get('minLeadMin') ?? 120),
      maxLeadDays: Number(formData.get('maxLeadDays') ?? 60),
      granularityMin: Number(formData.get('granularityMin') ?? 15),
      cancellationWindowHours: Number(formData.get('cancellationWindowHours') ?? 24),
      interServiceGapMin: Number(formData.get('interServiceGapMin') ?? 0),
    },
  }
}

/**
 * Até 2 turnos por dia (manhã/tarde) — cobre o caso comum do intervalo de almoço.
 *
 * Antes um turno meio preenchido — a hora de abrir escrita, a de fechar ainda
 * em branco — era simplesmente descartado: a loja gravava, a dona via "tudo
 * gravado", e a terça-feira ficava sem horário nenhum. Loja fechada à terça,
 * sem que ninguém tivesse dito isso. Agora o par incompleto recusa, e diz o
 * dia.
 */
function parseHours(formData: FormData): { rows: HoursInput[] } | { error: string } {
  const rows: HoursInput[] = []
  for (const weekday of WEEKDAYS) {
    const doDia: HoursInput[] = []
    for (const slot of [1, 2] as const) {
      const opensAt = String(formData.get(`h${weekday}_${slot}_start`) ?? '').trim()
      const closesAt = String(formData.get(`h${weekday}_${slot}_end`) ?? '').trim()
      if (!opensAt && !closesAt) continue
      if (!opensAt || !closesAt) {
        return {
          error: `Na ${DIA[weekday]}, o ${slot}º turno tem hora de ${opensAt ? 'fechar' : 'abrir'} em falta. Para fechar o dia, deixe os dois campos em branco.`,
        }
      }
      /* O banco tem um CHECK com esta mesma regra (`unit_hours_end_after_start`).
         Chegar lá era rebentar com SQL cru no ecrã da dona. */
      if (closesAt <= opensAt) {
        return {
          error: `Na ${DIA[weekday]}, o ${slot}º turno fecha às ${closesAt} e abre às ${opensAt} — o fim tem de vir depois do início.`,
        }
      }
      doDia.push({ weekday, opensAt, closesAt })
    }
    /* Dois turnos que se cruzam abririam a loja duas vezes no mesmo minuto, e a
       grelha da cliente mostraria a mesma hora a dobrar. A comparação não
       assume ordem: o intervalo de almoço tanto pode ser escrito manhã-tarde
       como ao contrário. */
    const [a, b] = doDia
    if (a && b && a.closesAt > b.opensAt && b.closesAt > a.opensAt) {
      return { error: `Na ${DIA[weekday]} os dois turnos sobrepõem-se. Verifique as horas.` }
    }
    rows.push(...doDia)
  }
  return { rows }
}

export async function salvarUnidade(
  _estado: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('id') ?? '')
  const input = parseUnit(formData)
  /* As duas recusas de baixo eram um `return` mudo: a dona carregava em
     Guardar, o ecrã ficava exactamente igual, e nada dizia que faltava o nome.
     Um botão que não responde é o defeito mais difícil de reportar. */
  if (!input.name) return { error: 'Dê um nome à loja.' }

  const horario = parseHours(formData)
  if ('error' in horario) return { error: horario.error }

  let unitId: string
  try {
    if (id === 'nova') await assertSuporte()
    const acesso = await assertRede()

    /* Sem o degrau de suporte o slug não é campo: vale sempre o que já está no
       banco. O formulário nem mostra o input, então quem chegar aqui com um slug
       diferente está forjando a requisição — e o pior desfecho é o campo ser
       ignorado, não o endereço mudar. */
    if (id !== 'nova' && !podeSuporte(acesso)) {
      const atual = await getUnitAdmin(id)
      if (!atual) throw new Error('unidade não encontrada')
      input.slug = atual.unit.slug
    }
    if (!input.slug) return { error: 'Falta o endereço no site — o slug da loja.' }

    /* Antes de criar seja o que for: recusar aqui a fotografia grande demais ou
       em HEIC é a diferença entre uma frase no formulário e uma loja
       meio-criada (ver `conferirImagem`). */
    const recusa = await recusaDaImagem(formData, 'imagem')
    if (recusa) return { error: recusa }

    unitId = id === 'nova' ? await createUnit(input) : id
    if (id !== 'nova') await updateUnit(id, input)
    await replaceUnitHours(unitId, horario.rows)
  } catch (e) {
    /* O slug repetido chega aqui como violação de unicidade, com o SQL inteiro
       na mensagem. Nomeia-se o que aconteceu em vez de o mostrar. */
    if (ehSlugRepetido(e)) {
      return { error: `Já existe uma loja com o endereço /${input.slug}. Escolha outro.` }
    }
    return { error: mensagemDoErro(e, 'não foi possível guardar esta loja') }
  }

  /*
    A foto vem depois da loja existir, porque a chave do ficheiro é montada com
    o id — numa loja nova esse id só existe agora. Devolver erro aqui deixaria a
    dona no `/nova`, com o campo escondido a dizer `id=nova`, e o segundo
    Guardar abriria uma segunda loja. Segue-se para a ficha da loja — que agora
    existe — e é ela que conta o que faltou.
  */
  let fotoFalhou = false
  try {
    const previous = id === 'nova' ? null : await getUnitImage(unitId)
    const imageUrl = await resolveImageField(formData, 'imagem', 'unidades', unitId, previous)
    if (imageUrl !== undefined) await setUnitImage(unitId, imageUrl)
  } catch (e) {
    console.error('[foto da unidade]', e)
    fotoFalhou = true
  }

  revalidatePath('/admin/unidades')
  // a foto aparece na escolha de unidade da cliente, que é estática por padrão
  revalidatePath('/agendar')
  redirect(`/admin/unidades/${unitId}${fotoFalhou ? '?foto=falhou' : ''}` as never)
}

/**
 * A recusa do índice único do slug, seja qual for a camada que a embrulhou.
 *
 * Pergunta-se pelo nome do índice (`units_org_slug_uq`, em
 * `schema/organization.ts`) e não só pelo código 23505: outra unicidade
 * qualquer no meio do caminho não deve sair do ecrã a falar de endereços.
 */
function ehSlugRepetido(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  const erro = e as { code?: unknown; constraint_name?: unknown }
  if (erro.code === '23505' && erro.constraint_name === 'units_org_slug_uq') return true
  return e.cause !== undefined && ehSlugRepetido(e.cause)
}

export async function adicionarExcecao(formData: FormData): Promise<void> {
  const unitId = String(formData.get('unitId') ?? '')
  const date = String(formData.get('date') ?? '')
  const closed = formData.get('closed') === 'on'
  if (!unitId || !date) return
  await assertRede()

  await addUnitException(unitId, {
    date,
    closed,
    opensAt: closed ? undefined : String(formData.get('opensAt') ?? '').trim() || undefined,
    closesAt: closed ? undefined : String(formData.get('closesAt') ?? '').trim() || undefined,
    reason: String(formData.get('reason') ?? '').trim() || undefined,
  })
  revalidatePath(`/admin/unidades/${unitId}`)
}

export async function removerExcecao(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const unitId = String(formData.get('unitId') ?? '')
  if (!id) return
  await assertRede()
  await removeUnitException(id)
  revalidatePath(`/admin/unidades/${unitId}`)
}

/*
  A galeria.

  As telas públicas que consomem estas fotos são `force-dynamic`, então não há
  o que revalidar além do próprio painel: a página da loja já lê do banco a
  cada visita.
*/

export interface EstadoDaGaleria {
  erro: string | null
}

/**
 * Sobe um lote de fotos.
 *
 * Única ação do cadastro de unidade com estado de retorno, e por um motivo: é a
 * única em que a recusa é rotina, não defeito. Um telemóvel manda HEIC, uma
 * fotografia sai da câmara com 14 MB — e a resposta a isso é uma frase no
 * formulário, não a página de erro do Next.
 */
export async function adicionarFotos(
  _estado: EstadoDaGaleria,
  formData: FormData,
): Promise<EstadoDaGaleria> {
  const unitId = String(formData.get('unitId') ?? '')
  if (!unitId) return { erro: null }
  await assertRede()

  const arquivos = formData
    .getAll('fotos')
    .filter((item): item is File => item instanceof File && item.size > 0)
  if (arquivos.length === 0) return { erro: 'Escolha pelo menos uma fotografia.' }

  try {
    const guardadas = await storeUploadedImages(arquivos, 'unidades', unitId)
    await addUnitPhotos(
      unitId,
      guardadas.map((foto) => ({ url: foto.url })),
    )
  } catch (erro) {
    if (erro instanceof UploadError) return { erro: erro.message }
    throw erro
  }

  revalidatePath(`/admin/unidades/${unitId}`)
  return { erro: null }
}

/**
 * Ordenar, legendar e remover — uma ação só, porque é um formulário só.
 *
 * A legenda é gravada em qualquer movimento, e não só no botão de guardar: quem
 * escreve a descrição e depois carrega em "subir" espera que o texto continue
 * lá. Perder o que a pessoa acabou de escrever é o defeito mais caro de um
 * formulário, e o mais fácil de evitar.
 */
export async function cuidarDaFoto(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  const unitId = String(formData.get('unitId') ?? '')
  const acao = String(formData.get('acao') ?? '')
  if (!id || !unitId) return
  await assertRede()

  if (acao === 'remover') {
    /* Apaga a linha primeiro e o arquivo depois: se o arquivo falhar, sobra um
       objeto órfão no bucket, que ninguém vê. Na ordem contrária sobraria uma
       linha apontando para um arquivo que já não existe — e isso a cliente vê. */
    await discardImage(await removeUnitPhoto(id))
    revalidatePath(`/admin/unidades/${unitId}`)
    return
  }

  await updateUnitPhotoAlt(id, String(formData.get('alt') ?? ''))
  if (acao === 'subir' || acao === 'descer') await moveUnitPhoto(id, acao)

  revalidatePath(`/admin/unidades/${unitId}`)
}
