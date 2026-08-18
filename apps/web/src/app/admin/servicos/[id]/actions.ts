'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { type EstadoDeFormulario } from '@/components/ui/erro-do-form'
import {
  createService,
  getServiceImage,
  setServiceImage,
  updateService,
  type ServiceInput,
} from '@/server/admin/services'
import { assertRede } from '@/server/auth/permissoes'
import { mensagemDoErro } from '@/server/erros'
import { recusaDaImagem, resolveImageField } from '@/server/storage/form'

function parseService(formData: FormData): ServiceInput {
  return {
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || undefined,
    categoryId: String(formData.get('categoryId') ?? '').trim() || undefined,
    basePrice: Math.round(Number(formData.get('basePriceReais') ?? 0) * 100),
    /* Duração é um número só no formulário. As três colunas do banco continuam
       existindo por causa do motor de agenda, então a duração inteira vai para
       a primeira e as outras zeram — bloco contínuo, sem encaixe. */
    setupMin: Number(formData.get('durationMin') ?? 0),
    processingMin: 0,
    finishMin: 0,
    onlineBookable: formData.get('onlineBookable') === 'on',
    active: formData.get('active') === 'on',
    staffIds: formData.getAll('staffIds').map(String),
  }
}

export async function salvarServico(
  _estado: EstadoDeFormulario,
  formData: FormData,
): Promise<EstadoDeFormulario> {
  const id = String(formData.get('id') ?? '')
  const input = parseService(formData)
  if (!input.name) return { error: 'Dê um nome ao serviço.' }
  /* Duração zero abriria um serviço que ocupa nada na agenda — a grade
     aceitaria infinitos no mesmo minuto. Antes as duas recusas eram um `return`
     mudo: a dona carregava em Guardar e o ecrã ficava igual, sem dizer que
     faltava a duração. */
  if (input.setupMin < 1) return { error: 'A duração tem de ser de pelo menos 1 minuto.' }
  /* Preço e duração valem nas três lojas de uma vez: é decisão da rede. */
  await assertRede()

  /* Antes de criar seja o que for: a fotografia grande demais ou em HEIC é o
     motivo comum de recusa, e recusá-la aqui é a diferença entre uma frase no
     formulário e um serviço meio-criado (ver `conferirImagem`). */
  const recusa = await recusaDaImagem(formData, 'imagem')
  if (recusa) return { error: recusa }

  let serviceId: string
  try {
    serviceId = id === 'novo' ? await createService(input) : id
    if (id !== 'novo') await updateService(id, input)
  } catch (e) {
    return { error: mensagemDoErro(e, 'não foi possível guardar este serviço') }
  }

  /*
    A foto vem depois do serviço existir, porque a chave do ficheiro é montada
    com o id — num serviço novo esse id só existe agora. O preço disso é que
    uma falha aqui chega com o serviço já criado, e antes ela subia como
    exceção: a dona via a página de erro, voltava atrás e carregava em Guardar
    outra vez, criando um segundo serviço igual. Duas «Escova» no cardápio da
    cliente, e nada a ligar uma coisa à outra.

    Por isso a falha da foto não devolve erro para o formulário: devolver o
    erro deixaria a dona no `/novo`, com o campo escondido a dizer `id=novo`, e
    o segundo Guardar criaria o segundo serviço na mesma. Segue-se em frente
    para a ficha do serviço — que agora existe — e é ela que conta o que
    faltou. A tentativa seguinte é uma edição, não uma criação.

    Os motivos comuns de recusa já foram apanhados lá em cima, antes de existir
    seja o que for; o que sobra aqui é o armazém em baixo.
  */
  let fotoFalhou = false
  try {
    const previous = id === 'novo' ? null : await getServiceImage(serviceId)
    const imageUrl = await resolveImageField(formData, 'imagem', 'servicos', serviceId, previous)
    if (imageUrl !== undefined) await setServiceImage(serviceId, imageUrl)
  } catch (e) {
    console.error('[foto do serviço]', e)
    fotoFalhou = true
  }

  revalidatePath('/admin/servicos')
  // o cardápio da cliente é por unidade e há mais de uma; o layout inteiro do
  // agendamento é o menor corte que cobre todas
  revalidatePath('/agendar', 'layout')
  redirect(`/admin/servicos/${serviceId}${fotoFalhou ? '?foto=falhou' : ''}` as never)
}
