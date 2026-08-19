import { redirect } from 'next/navigation'
import { CodeForm } from '@/components/auth/code-form'
import { CodigoDeTeste, Porta } from '@/components/auth/porta'
import { dicionario, interpola, pedacos } from '@/i18n'
import { VALIDADE_MIN } from '@/server/auth/codigo'
import { formatPhone } from '@/lib/format'
import { lerIdioma } from '@/lib/idioma'

export async function generateMetadata() {
  return { title: dicionario(await lerIdioma()).meta.verificarCodigo }
}

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

  const idioma = await lerIdioma()
  const t = dicionario(idioma).conta.verificar
  const destino = destinoValido(para)

  return (
    <Porta
      title={t.titulo}
      idioma={idioma}
      subtitle={
        destino ? (
          /* Partida em pedaços: o e-mail mascarado é o que ela vem procurar
             nesta frase, e leva o peso de texto forte. */
          <>
            {pedacos(t.comDestino).map((p, i) => {
              if (!('buraco' in p)) return <span key={i}>{p.texto}</span>
              if (p.buraco === 'destino') {
                return (
                  <span key={i} className="text-(--text-strong)">
                    {destino}
                  </span>
                )
              }
              return <span key={i}>{p.buraco === 'telefone' ? formatPhone(telefone) : VALIDADE_MIN}</span>
            })}
          </>
        ) : (
          /*
            Sem destino é o caminho em que pode não ter havido envio nenhum —
            número sem conta, ficha sem e-mail, pedido repetido dentro do
            minuto. A frase é a mesma nos três, senão esta tela devolvia por
            omissão o que `requestOtp` esconde por escrito.
          */
          <>{interpola(t.semDestino, { telefone: formatPhone(telefone) })}</>
        )
      }
    >
      <CodigoDeTeste codigo={dev} />
      <div className="surface rounded-card p-5">
        <CodeForm telefone={telefone} textos={t} />
      </div>
    </Porta>
  )
}
