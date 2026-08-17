import { redirect } from 'next/navigation'
import { CodeForm } from '@/components/auth/code-form'
import { CodigoDeTeste, Porta } from '@/components/auth/porta'
import { formatPhone } from '@/lib/format'

export const metadata = { title: 'Verificar código' }

/*
  `para` vem da URL, e URL qualquer um escreve. Só passa o que tem a cara do
  mascaramento que nós mesmos geramos — assim ninguém monta um link que diz à
  cliente que o código foi para o e-mail de outra pessoa.
*/
function destinoValido(para: string | undefined): string | undefined {
  if (!para) return undefined
  return /^[^\s@]{1,2}•+@[^\s@]+\.[^\s@]+$/.test(para) ? para : undefined
}

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ telefone?: string; para?: string; dev?: string }>
}) {
  const { telefone, para, dev } = await searchParams
  if (!telefone) redirect('/conta/entrar')

  const destino = destinoValido(para)

  return (
    <Porta
      title="Escreva o código"
      subtitle={
        destino ? (
          <>
            Enviámos um código para <span className="text-(--text-strong)">{destino}</span>, o
            e-mail da conta {formatPhone(telefone)}. Ele vale por 5 minutos.
          </>
        ) : (
          /*
            Sem destino é o caminho em que pode não ter havido envio nenhum —
            número sem conta, ficha sem e-mail, pedido repetido dentro do
            minuto. A frase é a mesma nos três, senão esta tela devolvia por
            omissão o que `RESPOSTA_UNICA` esconde por escrito.
          */
          <>
            Se houver conta em {formatPhone(telefone)}, o código já foi para o e-mail registado
            nela. Não chegou nada? Fale com o salão.
          </>
        )
      }
    >
      <CodigoDeTeste codigo={dev} />
      <div className="surface rounded-card p-5">
        <CodeForm telefone={telefone} />
      </div>
    </Porta>
  )
}
