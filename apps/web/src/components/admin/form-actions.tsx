'use client'

import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Button } from '@/components/ui/button'
import { useEstadoDoForm } from '@/components/ui/erro-do-form'
import { cn } from '@/lib/utils'

/**
 * Barra de ação fixa no fim de uma ficha longa.
 *
 * A ficha de unidade tem cinco seções e ~30 campos; a de profissional e a de
 * serviço não ficam muito atrás. Um botão "Salvar" solto no fim de tudo isso
 * some da vista assim que a pessoa rola para editar o segundo campo — ela
 * volta a descer a régua inteira só para gravar. Fixar a barra resolve isso
 * sem esconder nada: o formulário continua sendo "uma lista, um formulário,
 * salvar", só que salvar está sempre a um alcance de mão.
 *
 * O aviso ("alterações por gravar") observa o próprio `<form>` ancestral por
 * `input`/`change` — não precisa que cada campo seja controlado. Antes do
 * primeiro toque, ou logo depois de um envio bem-sucedido, o formulário está
 * limpo e a barra diz isso.
 *
 * ── Por que a recusa aparece aqui ─────────────────────────────────────────
 * É o único sítio da ficha onde se sabe que a pessoa está a olhar: ela acabou
 * de carregar no botão que está aqui. Uma frase no topo de um formulário de
 * cinco seções ficaria fora do ecrã. E como o estado vem por contexto, a barra
 * continua a funcionar tal e qual nos formulários que ainda não foram
 * convertidos — sem provedor, o estado é `{}` e nada muda.
 *
 * O botão desativa-se enquanto grava. Não é enfeite: era o segundo toque em
 * "Guardar", enquanto o primeiro ainda corria, que criava o serviço em
 * duplicado.
 */
export function FormActions({
  label = 'Guardar',
  className,
}: {
  label?: string
  className?: string
}) {
  const [dirty, setDirty] = useState(false)
  const marcadorRef = useRef<HTMLDivElement>(null)
  const { error, success } = useEstadoDoForm()
  const { pending } = useFormStatus()

  useEffect(() => {
    const form = marcadorRef.current?.closest('form')
    if (!form) return

    const marcar = () => setDirty(true)
    /* Ao enviar, o próprio navegador vai trocar de página ou o server action
       vai revalidar — não há um "limpo" para voltar a marcar depois daqui. */
    form.addEventListener('input', marcar)
    form.addEventListener('change', marcar)
    return () => {
      form.removeEventListener('input', marcar)
      form.removeEventListener('change', marcar)
    }
  }, [])

  /* A ficha que grava sem mudar de página (a escala, por exemplo) fica no
     mesmo ecrã com os campos que a pessoa acabou de escrever. Sem isto, a
     barra continuava a dizer "alterações por gravar" logo depois de gravar. */
  useEffect(() => {
    if (success) setDirty(false)
  }, [success])

  return (
    <div
      ref={marcadorRef}
      className={cn(
        'border-(--border-subtle) bg-(--surface)/95 sticky bottom-0 mt-2 flex items-center justify-between gap-4 border-t py-4 backdrop-blur-sm',
        className,
      )}
    >
      <p
        className={cn('text-sm', error ? 'text-(--estado-mau)' : 'text-muted')}
        role={error ? 'alert' : undefined}
        aria-live="polite"
      >
        {error ?? (pending ? 'A guardar…' : dirty ? 'Alterações por gravar.' : 'Tudo gravado.')}
      </p>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? 'A guardar…' : label}
      </Button>
    </div>
  )
}
