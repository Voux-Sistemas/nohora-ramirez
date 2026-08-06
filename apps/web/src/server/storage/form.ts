import 'server-only'
import { discardImage, storeUploadedImage, type UploadScope } from './images'

/**
 * Resolve o que o `ImageField` mandou no formulário.
 *
 * Três intenções cabem no mesmo par de campos, e o servidor precisa separar as
 * três: subiu arquivo novo (troca), marcou remover (apaga), ou não tocou
 * (mantém). "Manter" é `undefined`, não `null` — confundir os dois apagava a
 * foto de toda unidade salva por qualquer outro motivo.
 *
 * Devolve `undefined` para manter, ou a URL nova / `null` para gravar.
 */
export async function resolveImageField(
  formData: FormData,
  name: string,
  scope: UploadScope,
  ownerId: string,
  previous: string | null,
): Promise<string | null | undefined> {
  const file = formData.get(name)
  const remove = formData.get(`${name}_remover`) === '1'

  if (file instanceof File && file.size > 0) {
    const { url } = await storeUploadedImage(file, scope, ownerId)
    // só depois do novo estar gravado, para uma falha no meio não deixar o
    // cadastro apontando para um arquivo que já não existe
    await discardImage(previous)
    return url
  }

  if (remove) {
    await discardImage(previous)
    return null
  }

  return undefined
}
