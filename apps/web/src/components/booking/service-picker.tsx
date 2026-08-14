'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Photo } from '@/components/ui/photo'
import { formatMoney, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface PickableService {
  id: string
  name: string
  description: string | null
  /** Menor preço praticado na unidade, em centavos. */
  price: number
  /** Escolher a profissional pode subir esse preço — mostrar "a partir de". */
  priceVaries: boolean
  durationMin: number
  categoryName: string
  requiresAnamnesis: boolean
  depositLabel: string | null
  imageUrl: string | null
}

/**
 * Escolha de serviços. Multi-seleção porque visita real é combo — corte com
 * hidratação, mão e pé. O motor de disponibilidade encadeia os serviços num
 * horário só; a cliente não precisa marcar duas vezes.
 *
 * É um cardápio, e cardápio de lugar caro tem foto do prato e preço alinhado à
 * direita. A categoria vira título de seção com régua, não legenda minúscula em
 * versalete — nome de categoria é conteúdo, e conteúdo tem tamanho de conteúdo.
 *
 * Nem todo item tem foto, e está certo: escova e retoque de raiz não fotografam
 * de um jeito que ajude a decidir. Nesses a placa desenhada assume, e a fileira
 * continua com o mesmo peso visual.
 */
export function ServicePicker({
  nextHref,
  services,
  ctaLabel = 'Ver horários',
}: {
  /** Para onde ir com a escolha; os ids entram como `s=` nesta rota. */
  nextHref: string
  services: PickableService[]
  ctaLabel?: string
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [pending, setPending] = useState(false)

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const chosen = selected
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is PickableService => service !== undefined)
  const total = chosen.reduce((sum, service) => sum + service.price, 0)
  const duration = chosen.reduce((sum, service) => sum + service.durationMin, 0)
  // Basta um item com preço por profissional para o total ser piso, não conta.
  const totalVaries = chosen.some((service) => service.priceVaries)

  const groups = new Map<string, PickableService[]>()
  for (const service of services) {
    const list = groups.get(service.categoryName) ?? []
    list.push(service)
    groups.set(service.categoryName, list)
  }

  function advance() {
    setPending(true)
    const sep = nextHref.includes('?') ? '&' : '?'
    router.push(`${nextHref}${sep}s=${selected.join(',')}` as never)
  }

  return (
    <>
      <div className="space-y-12">
        {[...groups].map(([category, list]) => (
          <section key={category}>
            <div className="flex items-baseline gap-4">
              <h2 className="display shrink-0 text-[1.75rem]">{category}</h2>
              <span className="rule-bronze min-w-0 flex-1" aria-hidden />
            </div>

            <ul className="mt-5 grid gap-2.5">
              {list.map((service) => {
                const active = selected.includes(service.id)
                return (
                  <li key={service.id}>
                    <button
                      type="button"
                      onClick={() => toggle(service.id)}
                      aria-pressed={active}
                      className={cn(
                        'group flex w-full items-center gap-4 rounded-plate border p-3 text-left transition-[border-color,background-color,box-shadow] duration-200 ease-out sm:gap-5 sm:p-3.5',
                        active
                          ? 'border-(--surface-invert) bg-(--surface-raised) shadow-(--shadow-raise)'
                          : 'border-(--border-subtle) bg-(--surface-raised) hover:border-(--border-strong)',
                      )}
                    >
                      <span className="relative shrink-0">
                        <Photo
                          src={service.imageUrl}
                          alt=""
                          name={service.name}
                          sizes="120px"
                          className="h-20 w-20 rounded-plate sm:h-24 sm:w-24"
                        />
                        <span
                          aria-hidden
                          className={cn(
                            'absolute -top-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full bg-(--surface-invert) text-(--on-invert) transition-[opacity,transform] duration-200 ease-(--ease-out-quint)',
                            active ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
                          )}
                        >
                          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none">
                            <path
                              d="M3.5 8.5 6.5 11.5 12.5 4.5"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </span>

                      {/*
                        O preço fica na linha do nome, não solto no canto
                        superior. Cardápio se lê da esquerda para a direita, e
                        item de duas linhas contra item de três linhas deixava o
                        preço flutuando em alturas diferentes a cada fileira.
                      */}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-3">
                          <span className="min-w-0 flex-1 font-medium">{service.name}</span>
                          {/*
                            "a partir de" vem em corpo menor e apagado porque não
                            é o preço: é a condição dele. E vem EMPILHADO, não ao
                            lado — em linha ele roubava largura do nome e jogava
                            "Corte feminino" para duas linhas, deixando esse card
                            mais alto que os vizinhos sem nenhum motivo de
                            conteúdo. Empilhado ele ocupa a altura que a descrição
                            já gastava.
                          */}
                          <span className="shrink-0 text-right text-sm font-medium">
                            {service.priceVaries ? (
                              <span className="text-muted block text-xs leading-tight font-normal">
                                a partir de
                              </span>
                            ) : null}
                            <span className="tnum">{formatMoney(service.price)}</span>
                          </span>
                        </span>
                        {service.description ? (
                          <span className="text-muted mt-0.5 line-clamp-2 block text-sm">
                            {service.description}
                          </span>
                        ) : null}
                        <span className="text-muted tnum mt-1.5 block text-xs">
                          {formatDuration(service.durationMin)}
                          {service.depositLabel ? ` · sinal de ${service.depositLabel}` : ''}
                          {service.requiresAnamnesis ? ' · exige ficha de anamnese' : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-(--z-sticky) border-t border-(--border-subtle) bg-(--surface-raised)/95 shadow-(--shadow-lift) backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-4 px-5 py-3 sm:px-8">
          <div className="min-w-0 flex-1 text-sm">
            {chosen.length === 0 ? (
              <span className="text-muted">Escolha um ou mais serviços</span>
            ) : (
              <>
                <span className="tnum block truncate font-medium">
                  {chosen.length} {chosen.length === 1 ? 'serviço' : 'serviços'} ·{' '}
                  {totalVaries ? 'a partir de ' : ''}
                  {formatMoney(total)}
                </span>
                <span className="text-muted block text-xs">
                  cerca de {formatDuration(duration)} no salão
                </span>
              </>
            )}
          </div>
          <Button size="lg" disabled={chosen.length === 0 || pending} onClick={advance}>
            {pending ? 'A procurar…' : ctaLabel}
          </Button>
        </div>
      </div>
    </>
  )
}
