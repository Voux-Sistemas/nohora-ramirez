import Link from 'next/link'
import { PhoneForm } from '@/components/auth/phone-form'
import { Porta } from '@/components/auth/porta'
import { dicionario } from '@/i18n'
import { lerIdioma } from '@/lib/idioma'
import { loginClienteDisponivel } from '@/server/auth/otp'

export async function generateMetadata() {
  return { title: dicionario(await lerIdioma()).meta.entrar }
}

/*
  Sem isto o Next resolve a checagem no build e congela o resultado na página
  estática. Preencher as variáveis no Railway não teria efeito até o próximo
  deploy — e um deploy que herdasse a variável errada publicaria o formulário
  sem ninguém perceber. A decisão tem que ser por requisição.
*/
export const dynamic = 'force-dynamic'

export default async function ContaEntrarPage() {
  const idioma = await lerIdioma()
  const dic = dicionario(idioma)
  const t = dic.conta.entrar

  /*
    Sem canal de envio, o formulário só levaria a uma espera por mensagem que
    nunca chega. Melhor dizer a verdade e apontar o caminho que funciona hoje.
  */
  if (!loginClienteDisponivel()) {
    return (
      <Porta title={t.titulo} subtitle={t.indisponivelSubtitulo} idioma={idioma}>
        <div className="surface rounded-card p-5">
          <p className="text-sm leading-relaxed">{t.indisponivelTexto}</p>
          <p className="text-muted mt-4 text-sm leading-relaxed">
            {t.indisponivelSemConta}{' '}
            <Link className="underline underline-offset-4" href="/agendar">
              {t.indisponivelLink}
            </Link>
            .
          </p>
        </div>
      </Porta>
    )
  }

  return (
    <Porta
      title={t.titulo}
      subtitle={t.subtitulo}
      idioma={idioma}
      footer={
        <>
          {t.aindaCliente}{' '}
          <Link className="underline underline-offset-4 hover:text-(--text-strong)" href="/agendar">
            {t.marqueOPrimeiro}
          </Link>
          .
        </>
      }
    >
      <div className="surface rounded-card p-5">
        <PhoneForm textos={t} />
      </div>
    </Porta>
  )
}
