'use client'

import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PhotoRow } from '@/server/admin/units'

/*
  A galeria da loja, no painel.

  A ordem aqui é a ordem lá: a lista desta tela é literalmente a sequência que a
  página pública desenha, e por isso cada linha traz o número da posição. Não é
  enfeite — a primeira fotografia é a que abre a página quando não há capa, e
  quem administra precisa de ver isso sem ter de abrir a loja noutro separador.

  Componente de cliente por duas razões, ambas de erro: subir um lote de
  fotografias falha com frequência (um telemóvel manda HEIC, uma máquina manda
  14 MB) e a recusa tem de aparecer no formulário; e apagar uma fotografia
  destrói um ficheiro, o que merece uma pergunta antes.
*/

/** Espelha as regras do servidor para a recusa acontecer antes da viagem. */
const MAX_BYTES = 8 * 1024 * 1024
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

/*
  Teto do lote inteiro, um pouco abaixo do `bodySizeLimit` do next.config.ts.
  Passar desse número não devolve mensagem nenhuma: é o servidor a recusar o
  corpo antes de qualquer código nosso correr. Então o aviso é daqui.
*/
const MAX_LOTE_BYTES = 22 * 1024 * 1024

interface EstadoDaGaleria {
  erro: string | null
}

export function GaleriaDaLoja({
  unitId,
  fotos,
  aoAdicionar,
  aoCuidar,
}: {
  unitId: string
  fotos: readonly PhotoRow[]
  aoAdicionar: (estado: EstadoDaGaleria, formData: FormData) => Promise<EstadoDaGaleria>
  aoCuidar: (formData: FormData) => Promise<void>
}) {
  return (
    <div className="flex flex-col gap-6">
      {fotos.length === 0 ? (
        <p className="text-muted text-sm">
          Nenhuma fotografia ainda. A secção “A casa” só aparece na página da loja depois da
          primeira.
        </p>
      ) : (
        <ul className="divide-y divide-(--border-subtle) border-y border-(--border-subtle)">
          {fotos.map((foto, i) => (
            <Linha
              key={foto.id}
              foto={foto}
              posicao={i + 1}
              primeira={i === 0}
              ultima={i === fotos.length - 1}
              unitId={unitId}
              aoCuidar={aoCuidar}
            />
          ))}
        </ul>
      )}

      <Envio unitId={unitId} aoAdicionar={aoAdicionar} />
    </div>
  )
}

function Linha({
  foto,
  posicao,
  primeira,
  ultima,
  unitId,
  aoCuidar,
}: {
  foto: PhotoRow
  posicao: number
  primeira: boolean
  ultima: boolean
  unitId: string
  aoCuidar: (formData: FormData) => Promise<void>
}) {
  const [legenda, setLegenda] = useState(foto.alt ?? '')
  /* Comparar com a prop, e não com um valor inicial guardado: depois de gravar,
     a prop chega igual ao que foi escrito e o botão desaparece sozinho. */
  const mexida = legenda.trim() !== (foto.alt ?? '')

  return (
    <li>
      <form
        action={aoCuidar}
        className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3 sm:flex-nowrap"
      >
        <input type="hidden" name="id" value={foto.id} />
        <input type="hidden" name="unitId" value={unitId} />

        <span className="tnum text-muted w-5 shrink-0 text-sm tabular-nums">{posicao}</span>

        {/* `img` cru e não `next/image`: quem olha aqui é uma pessoa a organizar
            o cadastro, uma vez, e não a cliente em escala. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={foto.url}
          alt=""
          className="h-16 w-20 shrink-0 rounded-lg border border-(--border-subtle) bg-(--surface-sunken) object-cover"
        />

        <label className="flex min-w-0 grow basis-56 flex-col gap-1 text-sm">
          <span className="text-muted text-xs">Descrição para quem não vê a imagem</span>
          <input
            className="field"
            name="alt"
            value={legenda}
            onChange={(e) => setLegenda(e.target.value)}
            placeholder="Sala de lavagem com parede verde"
          />
        </label>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          {mexida ? (
            <Button type="submit" name="acao" value="legenda" variant="outline" size="sm">
              Guardar
            </Button>
          ) : null}

          <Button
            type="submit"
            name="acao"
            value="subir"
            variant="ghost"
            size="sm"
            disabled={primeira}
            aria-label={`Subir para a posição ${posicao - 1}`}
            title="Subir"
          >
            ↑
          </Button>
          <Button
            type="submit"
            name="acao"
            value="descer"
            variant="ghost"
            size="sm"
            disabled={ultima}
            aria-label={`Descer para a posição ${posicao + 1}`}
            title="Descer"
          >
            ↓
          </Button>
          <Button
            type="submit"
            name="acao"
            value="remover"
            variant="danger"
            size="sm"
            onClick={(e) => {
              if (!confirm('Apagar esta fotografia? O ficheiro não volta.')) e.preventDefault()
            }}
          >
            Apagar
          </Button>
        </div>
      </form>
    </li>
  )
}

function Envio({
  unitId,
  aoAdicionar,
}: {
  unitId: string
  aoAdicionar: (estado: EstadoDaGaleria, formData: FormData) => Promise<EstadoDaGaleria>
}) {
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [escolhidas, setEscolhidas] = useState<File[]>([])
  const [aviso, setAviso] = useState<string | null>(null)
  const [arrastando, setArrastando] = useState(false)
  const [estado, enviar, enviando] = useActionState(aoAdicionar, { erro: null })

  /* Limpa o campo depois de um envio aceite. Sem isto, as mesmas fotografias
     ficam armadas no input e o próximo clique sobe tudo outra vez. */
  useEffect(() => {
    if (enviando || estado.erro) return
    if (input.current) input.current.value = ''
    setEscolhidas([])
  }, [enviando, estado])

  function conferir(lista: FileList | null) {
    const arquivos = Array.from(lista ?? [])
    setEscolhidas(arquivos)

    const recusada = arquivos.find((f) => !ACCEPTED.includes(f.type))
    if (recusada) {
      setAviso(`“${recusada.name}” não é JPG, PNG, WebP nem AVIF.`)
      return
    }
    const pesada = arquivos.find((f) => f.size > MAX_BYTES)
    if (pesada) {
      setAviso(`“${pesada.name}” passa de 8 MB. Reduza e tente de novo.`)
      return
    }
    const total = arquivos.reduce((soma, f) => soma + f.size, 0)
    if (total > MAX_LOTE_BYTES) {
      setAviso(
        `São ${mb(total)} de uma vez, e o envio aceita ${mb(MAX_LOTE_BYTES)}. Mande em duas levas.`,
      )
      return
    }
    setAviso(null)
  }

  function soltar(event: React.DragEvent) {
    event.preventDefault()
    setArrastando(false)
    if (!input.current || event.dataTransfer.files.length === 0) return
    // devolve os ficheiros ao input para viajarem no submit
    input.current.files = event.dataTransfer.files
    conferir(event.dataTransfer.files)
  }

  const travado = enviando || escolhidas.length === 0 || aviso !== null

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="unitId" value={unitId} />

      {/*
        O rótulo É a zona de soltar, como no campo da capa: clique, teclado e
        arrastar caem no mesmo alvo e o input fica escondido sem sair do leitor
        de tela (`sr-only`, não `display:none`).
      */}
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastando(true)
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={soltar}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-1 rounded-plate border border-dashed px-5 py-8 text-center',
          'transition-[border-color,background-color] duration-200 ease-(--ease-out-quint)',
          arrastando
            ? 'border-(--accent) bg-(--surface-sunken)'
            : 'border-(--border-strong) hover:bg-(--surface-sunken)',
        )}
      >
        <span className="text-sm font-medium text-(--text-strong)">
          {arrastando ? 'Solte aqui' : 'Arraste as fotografias ou clique para escolher'}
        </span>
        <span className="text-muted text-xs">
          JPG, PNG, WebP ou AVIF, até 8 MB cada e {mb(MAX_LOTE_BYTES)} por vez.
        </span>
      </label>

      <input
        ref={input}
        id={inputId}
        name="fotos"
        type="file"
        multiple
        accept={ACCEPTED.join(',')}
        onChange={(e) => conferir(e.target.files)}
        className="sr-only"
      />

      {escolhidas.length > 0 ? (
        <ul className="text-muted flex flex-col gap-0.5 text-xs">
          {/* índice como chave: a lista nunca é reordenada, só trocada inteira,
              e dois ficheiros de pastas diferentes podem ter o mesmo nome */}
          {escolhidas.map((f, i) => (
            <li key={i} className="truncate">
              {f.name} · {mb(f.size)}
            </li>
          ))}
        </ul>
      ) : null}

      {/* O aviso local ganha do erro do servidor: é o mais recente, e é o único
          que a pessoa ainda pode corrigir sem enviar de novo. */}
      {(aviso ?? estado.erro) ? (
        <p role="alert" className="text-sm text-(--estado-mau)">
          {aviso ?? estado.erro}
        </p>
      ) : null}

      <Button type="submit" variant="outline" size="sm" disabled={travado} className="self-start">
        {enviando
          ? 'A enviar…'
          : escolhidas.length > 1
            ? `+ adicionar ${escolhidas.length} fotografias`
            : '+ adicionar fotografia'}
      </Button>
    </form>
  )
}

/* Uma casa decimal só abaixo de 10 MB: "0,4 MB" informa, "0,43 MB" só ocupa. */
function mb(bytes: number): string {
  const valor = bytes / 1024 / 1024
  return `${valor.toFixed(valor < 10 ? 1 : 0).replace('.', ',')} MB`
}
