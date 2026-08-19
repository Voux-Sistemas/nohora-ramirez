import type { Metadata } from 'next'
import Link from 'next/link'
import { BookingShell } from '@/components/booking/shell'
import { UnitPanel } from '@/components/booking/unit-panel'
import { dicionario } from '@/i18n'
import { lerIdioma } from '@/lib/idioma'
import { loginClienteDisponivel } from '@/server/auth/otp'
import { listUnits } from '@/server/scheduling/context'
import { portaDasUnidades } from '@/server/scheduling/hoje'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return { title: dicionario(await lerIdioma()).meta.marcar }
}

/**
 * Primeiro passo: onde.
 *
 * A escolha é de um lugar, então o lugar aparece do tamanho de um lugar. Uma
 * lista de endereços faz escolher pela rua que se reconhece; a fotografia
 * grande faz escolher pela sala. As duas casas têm exatamente o mesmo peso —
 * nenhuma é "a principal", e sugerir isso inventaria uma hierarquia que o
 * salão não declarou.
 */
export default async function EscolherUnidadePage() {
  const [units, idioma] = await Promise.all([listUnits(), lerIdioma()])
  const portas = await portaDasUnidades(units)
  const dic = dicionario(idioma)

  return (
    <BookingShell
      step={1}
      idioma={idioma}
      width="wide"
      title={dic.agendar.unidade.titulo}
      subtitle={dic.agendar.unidade.subtitulo}
    >
      <ul className={colunas(units.length)}>
        {units.map((unit, index) => (
          <li key={unit.id}>
            <UnitPanel
              unit={unit}
              hoje={portas.get(unit.id)}
              dic={dic}
              href={`/agendar/${unit.slug}`}
              priority={index === 0}
              sizes={sizesPara(units.length)}
            />
          </li>
        ))}
      </ul>

      {/*
        Esta tela é a casa pública do salão — quem escreve o endereço de cabeça
        cai aqui. Então é aqui que tem de estar a porta da conta da cliente, e
        não só no fim de uma marcação: quem já é da casa vem ver o horário que
        marcou, não marcar outro. Discreta, e depois das casas: marcar continua
        a ser o assunto da tela.

        Só aparece quando há por onde mandar o código de acesso — a mesma regra
        de `/conta/entrar`.
      */}
      {loginClienteDisponivel() ? (
        <p className="text-muted mt-12 border-t border-(--border-subtle) pt-6 text-sm">
          {dic.agendar.unidade.jaCliente}{' '}
          <Link href={'/conta' as never} className="underline underline-offset-4 hover:text-(--text-strong)">
            {dic.agendar.unidade.vejaAsSuas}
          </Link>
          .
        </p>
      ) : null}
    </BookingShell>
  )
}

/*
  A rede tem duas lojas, e duas fotografias lado a lado é um díptico: cada uma
  ocupa metade da parede e nenhuma pede desculpa pelo tamanho. Três viram um
  tríptico. A partir de quatro a peça encolhe até virar cartão — e aí esta tela
  precisa de outro desenho, não de mais uma coluna. O limite está escrito aqui
  de propósito, para quem abrir a quinta loja ler isto antes de reclamar.
*/
function colunas(total: number): string {
  const base = 'grid gap-5 sm:gap-6'
  if (total <= 1) return `${base} mx-auto max-w-2xl`
  if (total === 2) return `${base} sm:grid-cols-2`
  return `${base} sm:grid-cols-2 lg:grid-cols-3`
}

function sizesPara(total: number): string {
  if (total <= 1) return '(min-width: 672px) 672px, 100vw'
  if (total === 2) return '(min-width: 1024px) 496px, (min-width: 640px) 48vw, 100vw'
  return '(min-width: 1024px) 328px, (min-width: 640px) 48vw, 100vw'
}
