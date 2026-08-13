import { FluxoMarcacao } from '@/components/marcar/fluxo'
import { formatPhone } from '@/lib/format'
import { getSession } from '@/server/auth/session'
import { casasEscolhiveis, catalogoDaCasa } from '@/server/scheduling/marcacao'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Marcar' }

/**
 * A marcação.
 *
 * Uma rota, uma tela. O que antes eram quatro páginas encadeadas — com o
 * carrinho a viajar na querystring e o botão "voltar" a levar a estados que já
 * não existiam — é agora um fluxo com estado próprio (ver
 * `components/marcar/fluxo.tsx`).
 *
 * O servidor faz só o arranque: as casas, e — quando a cliente já chegou com
 * uma decidida — o catálogo dessa casa, para o primeiro passo já vir pintado
 * em vez de piscar um esqueleto por causa de uma ida ao servidor que se podia
 * ter feito antes.
 */
export default async function MarcarPage({
  searchParams,
}: {
  searchParams: Promise<{ casa?: string }>
}) {
  const { casa } = await searchParams
  const casas = await casasEscolhiveis()

  /* Só vale como pré-escolha se existir mesmo: um slug antigo num link
     partilhado não deve deixar a tela presa num passo que não abre. */
  const casaInicial = casas.some((item) => item.slug === casa) ? (casa ?? null) : null
  const casaEfectiva = casaInicial ?? (casas.length === 1 ? (casas[0]?.slug ?? null) : null)

  const [catalogoInicial, sessao] = await Promise.all([
    casaEfectiva ? catalogoDaCasa(casaEfectiva) : Promise.resolve(null),
    getSession(),
  ])

  return (
    <FluxoMarcacao
      casas={casas}
      casaInicial={casaInicial}
      catalogoInicial={catalogoInicial}
      cliente={
        sessao?.clientId
          ? /* O telemóvel volta em formato nacional: o campo mascara enquanto se
               digita e o `+351` colado à frente daria nove dígitos a mais. */
            { nome: sessao.name, telefone: formatPhone(sessao.phone) }
          : null
      }
    />
  )
}
