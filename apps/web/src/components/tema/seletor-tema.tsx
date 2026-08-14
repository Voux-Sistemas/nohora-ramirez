'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const COOKIE_TEMA = 'tema'

type Modo = 'claro' | 'escuro' | 'sistema'

function sistemaEscuro(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function lerModoDoCookie(): Modo {
  const linha = document.cookie.split('; ').find((l) => l.startsWith(`${COOKIE_TEMA}=`))
  const valor = linha?.slice(COOKIE_TEMA.length + 1)
  if (valor === 'claro' || valor === 'escuro') return valor
  if (valor === 'sistema-claro' || valor === 'sistema-escuro') return 'sistema'
  return 'claro'
}

/** Grava o cookie já resolvido e pinta `<html>` na hora — sem `router.refresh()`. */
function aplica(modo: Modo) {
  const escuro = modo === 'sistema' ? sistemaEscuro() : modo === 'escuro'
  const valor = modo === 'sistema' ? (escuro ? 'sistema-escuro' : 'sistema-claro') : modo
  document.cookie = `${COOKIE_TEMA}=${valor}; path=/; max-age=31536000; samesite=lax`
  document.documentElement.dataset.theme = escuro ? 'dark' : 'light'
}

const OPCOES: { modo: Modo; label: string; Icone: typeof Sun }[] = [
  { modo: 'sistema', label: 'Sistema', Icone: Monitor },
  { modo: 'claro', label: 'Claro', Icone: Sun },
  { modo: 'escuro', label: 'Escuro', Icone: Moon },
]

/**
 * Três estados, sobre tinta. Vive na barra da oficina — a mesma que está nos
 * seis layouts da área da dona — então um controlo cobre a área inteira.
 *
 * Não recebe o modo do servidor de propósito: ler o cookie aqui, no primeiro
 * efeito, evita passar `tema` como prop por seis layouts para uma escolha que
 * já pintou certa no primeiro render (o servidor decidiu `data-theme` a
 * partir do mesmo cookie, em `lib/tema.ts`). O único custo é um instante sem
 * nenhum botão marcado — nunca uma cor errada.
 *
 * Em "Sistema" o valor resolvido é regravado a cada mudança do SO: assim o
 * servidor, na visita seguinte, já acerta de primeira em vez de nascer a um
 * passo atrás.
 */
export function SeletorTema() {
  const [modo, setModo] = useState<Modo | null>(null)

  useEffect(() => {
    setModo(lerModoDoCookie())
  }, [])

  useEffect(() => {
    if (modo !== 'sistema') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const ouvir = () => aplica('sistema')
    mq.addEventListener('change', ouvir)
    return () => mq.removeEventListener('change', ouvir)
  }, [modo])

  function escolher(novo: Modo) {
    aplica(novo)
    setModo(novo)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className="border-(--border-on-ink) flex items-center gap-0.5 rounded-plate border p-0.5"
    >
      {OPCOES.map(({ modo: opcao, label, Icone }) => (
        <button
          key={opcao}
          type="button"
          role="radio"
          aria-checked={modo === opcao}
          aria-label={label}
          title={label}
          onClick={() => escolher(opcao)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-plate transition-colors',
            modo === opcao
              ? 'bg-(--on-ink) text-(--surface-ink)'
              : 'text-(--on-ink-muted) hover:text-(--on-ink)',
          )}
        >
          <Icone size={15} strokeWidth={2} aria-hidden />
        </button>
      ))}
    </div>
  )
}
