import { redirect } from 'next/navigation'
import { InstallForm } from '@/components/auth/install-form'
import { Porta } from '@/components/auth/porta'
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
    /* `home="/entrar"`: aqui ainda não há loja nenhuma cadastrada, e a montra
       levaria a uma vitrine vazia. A porta da equipa é o único destino que
       existe de verdade neste momento da instalação. */
    <Porta
      title="Começar"
      subtitle="Esta é a primeira conta do sistema — a conta da dona, com acesso a tudo. Depois de criada, este ecrã deixa de existir."
      home="/entrar"
    >
      <div className="surface rounded-card p-5">
        <InstallForm />
      </div>
    </Porta>
  )
}
