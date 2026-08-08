import { redirect } from 'next/navigation'
import { InstallForm } from '@/components/auth/install-form'
import { instalacaoAberta } from '@/server/auth/instalacao'

export const metadata = { title: 'Começar' }

/*
  Mesma razão de `/conta/entrar`: se o Next resolver isto no build, a resposta
  congela. Uma página estática continuaria oferecendo a instalação depois de a
  conta existir, e continuaria escondendo-a depois de a variável ser criada. A
  decisão tem que ser por requisição.
*/
export const dynamic = 'force-dynamic'

export default async function ComecarPage() {
  /*
    Fechada é indistinguível de inexistente, de propósito: quem chega aqui sem
    ter o que fazer aqui cai no login e não descobre nada sobre o estado do
    sistema — nem se já tem dono, nem se o código de instalação está configurado.
  */
  if (!(await instalacaoAberta())) redirect('/entrar')

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-sm flex-col justify-center px-5 py-12">
      <h1 className="text-2xl font-semibold">Começar</h1>
      <p className="text-muted mt-1 mb-6 text-sm">
        Esta é a primeira conta do sistema — a conta da dona, com acesso a tudo.
        Depois de criada, esta tela deixa de existir.
      </p>
      <div className="surface rounded-card p-5">
        <InstallForm />
      </div>
    </div>
  )
}
