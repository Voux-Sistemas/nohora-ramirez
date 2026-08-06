'use client'

import { useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/*
  Campo de foto do painel.

  A foto que entra aqui é a primeira coisa que a cliente vê na tela de escolha —
  ela decide por uma sala, não por um endereço. Então o campo mostra a imagem no
  mesmo formato em que a cliente vai encontrar, e mostra ANTES de salvar. Um
  `<input type="file">` cru devolve "nenhum arquivo selecionado" e a recepção
  descobre que subiu a foto errada quando uma cliente reclama.

  Vive dentro do `<form>` que já existe: o arquivo viaja junto com o resto dos
  dados na mesma server action, e não há endpoint separado nem estado a
  reconciliar entre "foto salva" e "cadastro salvo".
*/

/** Espelha as regras do servidor para o erro aparecer antes da viagem. */
const MAX_BYTES = 8 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export function ImageField({
  name,
  current,
  aspect = 'aspect-[4/5]',
  label = 'Foto',
  hint,
}: {
  /** Nome do campo de arquivo no FormData. */
  name: string
  /** URL já gravada, se houver. */
  current: string | null
  /** Proporção em que a cliente vai ver a imagem. */
  aspect?: string
  label?: string
  hint?: string
}) {
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)
  const [dragging, setDragging] = useState(false)

  const shown = preview ?? (removed ? null : current)

  function accept(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      setError('Formato não aceito. Envie JPG, PNG, WebP ou AVIF.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('A imagem passa de 8 MB. Reduza e tente de novo.')
      return
    }
    // objectURL em vez de FileReader: não carrega o arquivo inteiro na memória
    // só para desenhar uma miniatura
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(file)
    })
    setRemoved(false)
  }

  function drop(event: React.DragEvent) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files[0]
    if (!file || !input.current) return
    // devolve o arquivo ao input para ele viajar no submit do formulário
    input.current.files = event.dataTransfer.files
    accept(file)
  }

  function clear() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setError(null)
    setRemoved(true)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm">{label}</span>

      <div className="flex items-start gap-5">
        {/*
          O rótulo É a zona de soltar. Assim clique, teclado e arrastar caem no
          mesmo alvo, e o input fica escondido sem perder foco nem leitor de
          tela (`sr-only`, não `display:none`).
        */}
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={cn(
            'group relative w-40 shrink-0 cursor-pointer overflow-hidden rounded-plate border',
            'transition-[border-color,box-shadow] duration-200 ease-(--ease-out-quint)',
            aspect,
            dragging
              ? 'border-(--accent) shadow-(--shadow-lift)'
              : 'border-(--border-subtle) hover:border-(--border-strong)',
            shown ? 'bg-(--surface-sunken)' : 'bg-(--surface-ink)',
          )}
        >
          {shown ? (
            // `img` cru e não `next/image`: a fonte pode ser um blob: local que
            // o otimizador não tem como buscar, e aqui quem olha é a recepção
            // em um cadastro, não a cliente em escala.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 grid place-items-center px-3 text-center">
              <span className="label-caps text-(--on-ink-accent)">Sem foto</span>
            </span>
          )}

          <span
            aria-hidden
            className={cn(
              'absolute inset-x-0 bottom-0 px-3 py-2 text-center text-xs font-medium',
              'bg-(--surface-ink)/85 text-(--on-ink) opacity-0 transition-opacity duration-200',
              'group-hover:opacity-100 group-focus-within:opacity-100',
              dragging && 'opacity-100',
            )}
          >
            {dragging ? 'Solte aqui' : shown ? 'Trocar' : 'Escolher'}
          </span>
        </label>

        <div className="flex min-w-0 flex-col gap-2 pt-1 text-sm">
          <input
            ref={input}
            id={inputId}
            name={name}
            type="file"
            accept={ACCEPTED.join(',')}
            onChange={(e) => accept(e.target.files?.[0])}
            className="sr-only"
          />

          <p className="text-muted">
            {hint ?? 'JPG, PNG, WebP ou AVIF, até 8 MB.'}
            <br />
            Arraste para cima da moldura ou clique nela.
          </p>

          {shown ? (
            <button
              type="button"
              onClick={clear}
              className="self-start text-(--color-signal-bad) transition-opacity hover:opacity-70"
            >
              Remover foto
            </button>
          ) : null}

          {/*
            `removed` é campo, não estado só de tela: sem ele o servidor não
            distingue "não mexi na foto" de "quero esta unidade sem foto".
          */}
          <input type="hidden" name={`${name}_remover`} value={removed ? '1' : ''} />

          {error ? (
            <p role="alert" className="text-(--color-signal-bad)">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
