import Link from 'next/link'
import { EmTransito } from '@/components/ui/espera'
import { Photo } from '@/components/ui/photo'
import { cn, href } from '@/lib/utils'
import type { UnitInfo } from '@/server/scheduling/context'
import { frasePorta, type HojeNaLoja } from '@/server/scheduling/hoje'

/**
 * A casa como porta — a peça central do painel da rede.
 *
 * Nasceu separada do `UnitPanel` do agendamento porque as duas telas fazem
 * perguntas diferentes à mesma fotografia. Lá, a pessoa já decidiu marcar e só
 * falta dizer onde; a peça é um passo de formulário e tem de caber ao lado de
 * uma barra de progresso. Aqui a pessoa ainda não decidiu nada, e a peça é a
 * própria montra: ocupa a parede, o nome é do tamanho de um nome de fachada, e
 * o que ela promete não é "seguinte" — é entrar.
 *
 * Partilhar um componente entre as duas obrigaria a um argumento de tamanho, e
 * um componente com um argumento de tamanho é dois componentes com o código
 * entrelaçado. Ficam dois, e o do agendamento fica como está.
 *
 * O retrato é 3:4 e não 4:5 por causa do material: as fotografias do estúdio
 * vêm comprimidas a 1600px de largura, e um recorte alto tira mais partido da
 * altura que existe do que uma banda larga esticada. Enquanto não houver
 * originais, é o desenho que o ficheiro aguenta sem ficar mole.
 */
export function PortaDaCasa({
  unidade,
  hoje,
  priority = false,
  sizes,
}: {
  unidade: UnitInfo
  hoje?: HojeNaLoja
  priority?: boolean
  sizes: string
}) {
  const frase = hoje ? frasePorta(hoje.estado) : null
  const aberta = hoje?.estado.tipo === 'aberta'

  return (
    <Link
      href={href(`/loja/${unidade.slug}`)}
      className="group relative block overflow-hidden rounded-plate ring-1 ring-(--border-subtle) shadow-(--shadow-lift)"
    >
      <EmTransito />

      <Photo
        src={unidade.imageUrl}
        alt={`Salão Nohora Ramirez em ${unidade.name}`}
        name={unidade.name}
        interactive
        priority={priority}
        sizes={sizes}
        className="aspect-[4/5] w-full sm:aspect-[3/4]"
      />

      {/* O véu cobre dois terços: em cima a sala fica limpa, em baixo o nome
          tem chão para assentar em qualquer fotografia. */}
      <div
        className="scrim-photo pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
        aria-hidden
      />

      {/* O estado da porta em pastilha, no alto e longe do nome. É a única
          informação desta peça que muda ao longo do dia, e informação que muda
          não se mistura com o que é fixo. */}
      {frase ? (
        <p
          className={cn(
            'absolute top-4 left-4 flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.75rem] sm:top-5 sm:left-5',
            'bg-(--surface-ink)/78 text-(--on-ink)',
          )}
        >
          {aberta ? (
            <span className="h-1.5 w-1.5 rounded-full bg-(--on-ink-accent)" aria-hidden />
          ) : null}
          {frase}
        </p>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
        {/* Bem acima do piso de 28px da Bodoni — é o maior tipo da tela, e é
            para se ler do outro lado da rua, como se lê uma fachada. */}
        <h2 className="display text-(--on-ink) text-[clamp(2.25rem,5.5vw,3.25rem)] leading-[1.0]">
          {unidade.name}
        </h2>

        <div className="rule-bronze-on-ink mt-5 w-12 transition-[width] duration-700 ease-(--ease-out-quint) group-hover:w-28" />

        {unidade.addressLine ? (
          <p className="mt-5 max-w-[30ch] text-[0.9375rem] leading-snug text-(--on-ink-muted)">
            {unidade.addressLine}
          </p>
        ) : null}

        {/* Uma fotografia inteira clicável não anuncia que é clicável. Esta
            linha di-lo por extenso, e a seta anda um pouco à frente da mão. */}
        <p className="mt-6 flex items-center gap-2 text-[0.875rem] text-(--on-ink)">
          Ver a casa
          <span
            aria-hidden
            className="transition-transform duration-500 ease-(--ease-out-quint) group-hover:translate-x-1.5"
          >
            →
          </span>
        </p>
      </div>
    </Link>
  )
}
