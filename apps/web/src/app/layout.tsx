import type { Metadata, Viewport } from 'next'
import { Archivo, Bodoni_Moda } from 'next/font/google'
import { lerTema } from '@/lib/tema'
import './globals.css'

/*
  Bodoni Moda é a letra da própria logo: didone de altíssimo contraste com eixo
  de tamanho óptico. Não é "uma serifa elegante" escolhida por gosto — é a mesma
  família de desenho do monograma NR, então o título da página e a marca falam a
  mesma língua. Só entra em ≥28px; hairline de didone em corpo de texto some.
*/
const bodoni = Bodoni_Moda({
  subsets: ['latin'],
  variable: '--font-bodoni',
  display: 'swap',
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
})

/*
  Archivo carrega texto e interface. Grotesca de notícia: numeral tabular firme
  (o produto é feito de hora e de dinheiro) e largura suficiente para se ler num
  tablet a um braço de distância. Par por eixo de contraste com a didone, que é
  o par de editorial de moda desde sempre.
*/
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
})

const STUDIO = 'Nohora Ramirez'

export const metadata: Metadata = {
  title: {
    default: `${STUDIO} · Beauty Studio`,
    template: `%s · ${STUDIO}`,
  },
  description: 'Agendamento e gestão do Nohora Ramirez Beauty Studio.',
}

/*
  O tema já está resolvido quando esta página é servida (cookie, lido no
  layout) — não faz mais sentido anunciar duas cores por `prefers-color-scheme`
  quando só uma delas é a que a página realmente vai vestir. `generateViewport`
  em vez de um `viewport` estático porque a cor depende do cookie da pessoa.
*/
export async function generateViewport(): Promise<Viewport> {
  const tema = await lerTema()
  return {
    // a recepção usa tablet e a cliente usa celular
    width: 'device-width',
    initialScale: 1,
    themeColor: tema.resolvido === 'dark' ? '#16110f' : '#f5f0ea',
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const tema = await lerTema()
  return (
    <html lang="pt-PT" data-theme={tema.resolvido} className={`${bodoni.variable} ${archivo.variable}`}>
      <body>
        {/*
          ── CONTRATO DE DIREÇÃO ───────────────────────────────────────────────
          NOHORA RAMIREZ — Beauty Studio
          Mundo fixado pelo cliente: o padrão da categoria, executado com
          fidelidade total. Ele viu direções fora do padrão e escolheu a
          convenção — o trabalho é ser a melhor versão dela, não outra coisa.

          THESIS
          Marcar um horário aqui é escolher uma pessoa, uma hora e um lugar — não
          preencher um formulário. Cada uma dessas três escolhas aparece com
          rosto, com fotografia e com nome, do jeito que uma reserva de
          restaurante bom aparece. O sistema desaparece atrás da escolha.

          OWN-WORLD
          Travertino quente, tinta quase preta e bronze escovado — o material de
          um salão de alto padrão, não o creme lavado com dourado brilhante que é
          o rendering automático da categoria. A tinta é a cor da marca porque a
          logo é monocromática: o monograma NR não trouxe cor nenhuma para
          herdar. Bronze é fio, régua e selo; nunca é botão. A assinatura gráfica
          é a régua de bronze que fecha um bloco, tirada da coroa botânica da
          logo. Voz de display: Bodoni Moda, a própria letra do monograma.

          STORY
          Vitrine e oficina são a mesma marca em duas temperaturas. A cliente, no
          celular às 22h40, recebe fotografia grande, ar e uma pergunta por tela.
          A recepção, de pé no tablet sob luz de salão, recebe o mesmo mundo em
          densidade alta: fio no lugar de sombra, número tabular, alvo de 44px.
          A cor não muda; o espaçamento e o tamanho da foto mudam.

          FIRST VIEWPORT
          Placa de fotografia da unidade em sangria, o nome do estúdio em Bodoni
          por cima do véu, e imediatamente abaixo a primeira pergunta real —
          onde você quer ser atendida. Sem herói decorativo: a foto É a escolha.

          FORM
          Raio único e pequeno (4px) em placa e controle; pílula só onde é
          genuinamente pílula (chip, selo, avatar). Elevação é rara e reservada à
          barra fixa e ao diálogo — conteúdo se separa por fio, não por sombra.
          Lista de serviço e de horário é régua editorial, não sopa de card.
          Fotografia faz trabalho estrutural: é o objeto, não o enfeite.

          FINISH
          O momento autoral é a confirmação: o swash calígráfico do monograma se
          desenha como selo sobre o horário marcado. É o gesto mais distintivo da
          marca, usado uma vez, no único instante do fluxo que merece um gesto.
          Todo o resto é transição curta com saída exponencial, e tudo tem
          alternativa em prefers-reduced-motion.
          ──────────────────────────────────────────────────────────────────────
        */}
        {children}
      </body>
    </html>
  )
}
