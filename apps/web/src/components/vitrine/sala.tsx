'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Photo } from '@/components/ui/photo'
import type { FotoDaLoja } from '@/server/vitrine'

/**
 * A sala, em fotografias de tamanhos diferentes.
 *
 * O tamanho desigual não é enfeite: é o que faz três fotografias lerem como
 * escolha e não como escassez. Numa grade de peças iguais, o olho conta — três
 * quadrados iguais dizem "só havia três". Numa composição em que uma imagem
 * manda e as outras acompanham, o olho lê hierarquia, que é o que uma revista
 * faz com o mesmo material.
 *
 * Isto importa concretamente aqui: uma das lojas tem seis fotografias boas e a
 * outra tem três. As duas páginas precisam parecer igualmente cuidadas.
 *
 * MECÂNICA — por que altura fixa e não proporção fixa:
 * numa fileira com duas imagens de larguras diferentes, proporção fixa dá
 * alturas diferentes e abre um buraco embaixo da mais estreita. Fixando a
 * ALTURA da fileira e deixando a largura variar, o corte acontece dentro da
 * imagem (`object-cover`), as bases alinham e a desigualdade fica onde deve
 * estar: na largura.
 *
 * A CAIXA DE LUZ, e por que a legenda não está na grade:
 * cada fotografia traz uma descrição escrita à mão, e boa — mas seis delas por
 * baixo das imagens são cento e tal palavras de prosa no meio de uma página que
 * o cliente já chamou de cansativa. A legenda aparece ampliada, para quem pediu
 * para ver. Na grade, o que se vê é a sala.
 *
 * A degradação é a razão de a fotografia estar dentro de um `<a>` e não de um
 * `<button>`: sem JavaScript, cada uma abre o próprio ficheiro no visualizador
 * do navegador — que é uma caixa de luz a sério, a da plataforma. Com
 * JavaScript, o clique é interceptado e abre-se o `<dialog>` nativo, que traz
 * de graça o `Esc`, o foco preso lá dentro, o fundo inerte e a devolução do
 * foco à fotografia de onde se partiu.
 */
export function Sala({ fotos, nome }: { fotos: readonly FotoDaLoja[]; nome: string }) {
  const [aberta, setAberta] = useState<number | null>(null)

  if (fotos.length === 0) return null

  return (
    <>
      <div className="flex flex-col gap-3 sm:gap-4">
        {emPares(fotos).map((fileira, i) => (
          <Fileira
            key={i}
            fotos={fileira}
            nome={nome}
            indice={i}
            primeira={i === 0}
            deslocamento={i * 2}
            aoAmpliar={setAberta}
          />
        ))}
      </div>

      <CaixaDeLuz
        fotos={fotos}
        nome={nome}
        aberta={aberta}
        aoMudar={setAberta}
        aoFechar={() => setAberta(null)}
      />
    </>
  )
}

/*
  Pares, com a sobra virando panorâmica de largura inteira. Com três fotos:
  duas em cima, uma larga fechando embaixo — que é exatamente o desenho que
  uma revista daria a três imagens.
*/
function emPares(fotos: readonly FotoDaLoja[]): FotoDaLoja[][] {
  const fileiras: FotoDaLoja[][] = []
  for (let i = 0; i < fotos.length; i += 2) {
    fileiras.push(fotos.slice(i, i + 2))
  }
  return fileiras
}

/* Proporções alternadas: a mesma 1.45/1 em toda fileira vira padrão de papel
   de parede, que é o defeito que a composição desigual veio evitar. */
const PESOS: readonly [number, number][] = [
  [1.45, 1],
  [1, 1.6],
  [1.25, 1],
]

function Fileira({
  fotos,
  nome,
  indice,
  primeira,
  deslocamento,
  aoAmpliar,
}: {
  fotos: FotoDaLoja[]
  nome: string
  indice: number
  primeira: boolean
  /** Posição da primeira fotografia da fileira na galeria inteira. */
  deslocamento: number
  aoAmpliar: (indice: number) => void
}) {
  const sozinha = fotos.length === 1
  const [a, b] = PESOS[indice % PESOS.length]!

  return (
    <div
      className={
        sozinha
          ? ''
          : /* Empilhadas no telemóvel: lado a lado, duas fotografias de meia
               largura ficam do tamanho de miniatura e a sala some. */
            'flex flex-col gap-3 sm:h-[clamp(15rem,38vw,30rem)] sm:flex-row sm:gap-4'
      }
    >
      {fotos.map((foto, i) => (
        <div
          key={foto.url}
          className={sozinha ? '' : 'sm:min-w-0'}
          style={sozinha ? undefined : { flex: `${i === 0 ? a : b} 1 0%` }}
        >
          <a
            href={foto.url}
            target="_blank"
            rel="noreferrer"
            onClick={(evento) => {
              /* Um clique com modificador é um pedido de "abre noutro
                 separador", e esse gesto é do navegador. Interceptá-lo seria
                 roubar uma coisa que a pessoa já sabe fazer. */
              if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.button !== 0) return
              /* Sem `showModal` — Safari antigo — não se intercepta nada: o
                 clique segue para o ficheiro, que é a caixa de luz do navegador. */
              if (typeof HTMLDialogElement?.prototype?.showModal !== 'function') return
              evento.preventDefault()
              aoAmpliar(deslocamento + i)
            }}
            className="group block h-full cursor-zoom-in"
          >
            <Photo
              src={foto.url}
              alt={foto.alt ?? `Interior do salão ${nome}`}
              name={nome}
              interactive
              sizes={
                sozinha ? '(min-width: 1152px) 1088px, 100vw' : '(min-width: 640px) 55vw, 100vw'
              }
              priority={primeira && i === 0}
              className={
                sozinha
                  ? 'aspect-[4/3] w-full rounded-plate sm:aspect-[21/9]'
                  : 'aspect-[4/3] w-full rounded-plate sm:h-full sm:aspect-auto'
              }
            />
          </a>
        </div>
      ))}
    </div>
  )
}

function CaixaDeLuz({
  fotos,
  nome,
  aberta,
  aoMudar,
  aoFechar,
}: {
  fotos: readonly FotoDaLoja[]
  nome: string
  aberta: number | null
  aoMudar: (indice: number) => void
  aoFechar: () => void
}) {
  const caixa = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const elemento = caixa.current
    if (!elemento) return
    if (aberta !== null && !elemento.open) elemento.showModal()
    if (aberta === null && elemento.open) elemento.close()
  }, [aberta])

  /* Volta ao princípio no fim, e ao fim no princípio. Uma galeria de três
     fotografias com botões que se apagam nas pontas é mais botão apagado do
     que botão. */
  const andar = useCallback(
    (passo: number) => {
      if (aberta === null || fotos.length === 0) return
      aoMudar((aberta + passo + fotos.length) % fotos.length)
    },
    [aberta, aoMudar, fotos.length],
  )

  const foto = aberta === null ? undefined : fotos[aberta]

  return (
    <dialog
      ref={caixa}
      aria-label={`Fotografias do salão ${nome}`}
      onClose={aoFechar}
      onClick={(evento) => {
        /* Só o próprio diálogo — que é o fundo. Um clique no conteúdo tem
           outro alvo e não fecha nada. */
        if (evento.target === caixa.current) aoFechar()
      }}
      onKeyDown={(evento) => {
        if (evento.key === 'ArrowRight') andar(1)
        if (evento.key === 'ArrowLeft') andar(-1)
      }}
      className="caixa-de-luz text-(--on-ink) [--focus:var(--on-ink-accent)]"
    >
      {foto ? (
        <div className="flex h-full w-full flex-col">
          <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <p className="tnum text-[0.8125rem] text-(--on-ink-muted)">
              {(aberta ?? 0) + 1} / {fotos.length}
            </p>
            {/* Primeiro no documento de propósito: `showModal` põe o foco no
                primeiro elemento focável, e o primeiro gesto que uma pessoa
                precisa de encontrar aqui é a saída. */}
            <button
              type="button"
              onClick={aoFechar}
              className="rounded-plate px-3 py-1.5 text-[0.875rem] text-(--on-ink-muted) transition-colors hover:text-(--on-ink)"
            >
              Fechar
            </button>
          </div>

          <div className="relative min-h-0 flex-1">
            <Image
              src={foto.url}
              alt={foto.alt ?? `Interior do salão ${nome}`}
              fill
              sizes="100vw"
              className="object-contain"
            />
          </div>

          <div className="flex shrink-0 items-center gap-4 px-5 py-5 sm:px-8">
            {fotos.length > 1 ? (
              <Seta rotulo="Fotografia anterior" sinal="‹" aoCarregar={() => andar(-1)} />
            ) : null}

            {/* A legenda escrita à mão, finalmente visível — e aqui, onde há
                espaço para ela e onde alguém pediu para ver esta fotografia
                em particular. */}
            <p className="min-w-0 flex-1 text-center text-[0.875rem] leading-relaxed text-(--on-ink-muted)">
              {foto.alt}
            </p>

            {fotos.length > 1 ? (
              <Seta rotulo="Fotografia seguinte" sinal="›" aoCarregar={() => andar(1)} />
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}

function Seta({
  rotulo,
  sinal,
  aoCarregar,
}: {
  rotulo: string
  sinal: string
  aoCarregar: () => void
}) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      onClick={aoCarregar}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[1.5rem] leading-none text-(--on-ink-muted) transition-colors hover:bg-(--surface-ink) hover:text-(--on-ink)"
    >
      <span aria-hidden>{sinal}</span>
    </button>
  )
}
