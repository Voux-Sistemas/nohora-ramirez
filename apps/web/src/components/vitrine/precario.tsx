import { formatMoney } from '@/lib/format'
import type { GrupoPrecario } from '@/server/vitrine'

/**
 * O preçário, como preçário impresso.
 *
 * Não é uma tabela de dados nem uma grade de cartões de serviço: é o cartão que
 * fica no balcão. Duas colunas de texto, título de bloco em Bodoni, linha com
 * nome à esquerda e preço à direita, fio fino entre uma e outra. É o desenho que
 * um menu de restaurante bom usa há um século, pelo mesmo motivo: a pessoa
 * percorre nomes e só depois olha o número.
 *
 * DURAÇÃO NÃO APARECE AQUI, de propósito. O preçário em papel do estúdio não a
 * traz, e a duração que o sistema conhece é a que a agenda precisa para reservar
 * a cadeira — número operacional, sujeito a ajuste por profissional. Publicá-lo
 * como promessa transformaria uma estimativa interna em compromisso com a
 * cliente. Quem quer saber quanto demora chega a esse número na tela de marcação,
 * onde ele já vem com a pessoa e o horário reais.
 *
 * Colunas de CSS e não grade: o conteúdo é fluxo de texto de alturas desiguais,
 * que é exatamente o problema que `columns` resolve e `grid` não. `break-inside`
 * mantém o bloco inteiro de um lado só — meia lista de "Mãos e Pés" numa coluna
 * e metade na outra faria a cliente ler o mesmo título duas vezes.
 */
export function Precario({ grupos }: { grupos: readonly GrupoPrecario[] }) {
  if (grupos.length === 0) return null

  return (
    <div className="gap-x-14 sm:columns-2 lg:gap-x-20">
      {grupos.map((grupo) => (
        <section key={grupo.id} className="mb-11 break-inside-avoid sm:mb-14">
          <h3 className="display display-md">{grupo.nome}</h3>
          <div className="rule-bronze mt-3.5 w-12" />

          <dl className="mt-5">
            {grupo.itens.map((item) => (
              <div
                key={item.id}
                className="flex items-baseline justify-between gap-5 border-b border-(--border-subtle) py-2.5"
              >
                <dt className="text-body text-[0.9375rem] leading-snug">
                  {item.nome}
                  {item.requerAvaliacao ? (
                    <span className="text-muted block text-[0.8125rem] italic">
                      mediante avaliação
                    </span>
                  ) : null}
                </dt>
                {/* `tnum` alinha a coluna de preços; `whitespace-nowrap` impede
                    que "120,00 €" parta entre o número e o símbolo. */}
                <dd className="tnum shrink-0 text-[0.9375rem] whitespace-nowrap text-(--text-strong)">
                  {formatMoney(item.preco)}
                </dd>
              </div>
            ))}
          </dl>

          {/* A ressalva ao pé do bloco, onde ela está no papel — depois dos
              preços, que é onde a dúvida aparece. */}
          {grupo.nota ? (
            <p className="text-muted mt-3.5 max-w-[42ch] text-[0.8125rem] leading-relaxed italic">
              {grupo.nota}
            </p>
          ) : null}
        </section>
      ))}
    </div>
  )
}
