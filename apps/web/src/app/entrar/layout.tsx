import Link from 'next/link'
import { Wordmark } from '@/components/brand/mark'
import { href } from '@/lib/utils'

/**
 * A porta.
 *
 * As três telas de entrada — cliente, código e equipa — moram sob a mesma
 * casca. Antes eram `/entrar`, `/conta/entrar` e `/conta/verificar`: três
 * desenhos diferentes, nenhum com marca, e a da equipa a mandar para `/admin`
 * enquanto a da cliente mandava para `/conta`. Quem se enganava de porta não
 * tinha como saber que existia outra.
 *
 * Uma coluna estreita e centrada, com o logotipo em cima e o caminho de volta
 * à vitrine embaixo — porque a maior parte de quem cai aqui por engano só
 * queria marcar, e marcar não precisa de conta.
 */
export default function EntrarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-(--surface-ink) text-(--on-ink) [--focus:var(--on-ink-accent)]">
        <div className="mx-auto w-full max-w-5xl px-5 py-3.5 sm:px-8">
          <Link href={href('/')} className="rounded-plate inline-block" aria-label="Nohora Ramirez">
            <Wordmark size="sm" align="left" />
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-12">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-sm px-5 pb-10 text-center">
        <p className="text-muted text-[0.8125rem]">
          Para marcar não precisa de conta.{' '}
          <Link
            href={href('/marcar')}
            className="text-(--text-strong) underline underline-offset-4"
          >
            Marque por aqui
          </Link>
          .
        </p>
      </footer>
    </div>
  )
}
