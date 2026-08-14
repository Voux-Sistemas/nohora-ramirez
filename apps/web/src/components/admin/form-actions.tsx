'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
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
 */
export function FormActions({
  label = 'Salvar',
  className,
}: {
  label?: string
  className?: string
}) {
  const [dirty, setDirty] = useState(false)
  const marcadorRef = useRef<HTMLDivElement>(null)

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

  return (
    <div
      ref={marcadorRef}
      className={cn(
        'border-(--border-subtle) bg-(--surface)/95 sticky bottom-0 mt-2 flex items-center justify-between gap-4 border-t py-4 backdrop-blur-sm',
        className,
      )}
    >
      <p className="text-muted text-sm" aria-live="polite">
        {dirty ? 'Alterações por gravar.' : 'Tudo gravado.'}
      </p>
      <Button type="submit" size="lg">
        {label}
      </Button>
    </div>
  )
}
