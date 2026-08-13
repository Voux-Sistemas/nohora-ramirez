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
 */
export function Sala({ fotos, nome }: { fotos: readonly FotoDaLoja[]; nome: string }) {
  if (fotos.length === 0) return null

  const fileiras = emPares(fotos)

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {fileiras.map((fileira, i) => (
        <Fileira key={i} fotos={fileira} nome={nome} indice={i} primeira={i === 0} />
      ))}
    </div>
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
}: {
  fotos: FotoDaLoja[]
  nome: string
  indice: number
  primeira: boolean
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
          <Photo
            src={foto.url}
            alt={foto.alt ?? `Interior do salão ${nome}`}
            name={nome}
            sizes={sozinha ? '(min-width: 1152px) 1088px, 100vw' : '(min-width: 640px) 55vw, 100vw'}
            priority={primeira && i === 0}
            className={
              sozinha
                ? 'aspect-[4/3] w-full rounded-plate sm:aspect-[21/9]'
                : 'aspect-[4/3] w-full rounded-plate sm:h-full sm:aspect-auto'
            }
          />
        </div>
      ))}
    </div>
  )
}
