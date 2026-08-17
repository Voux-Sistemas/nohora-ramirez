/**
 * Repartir o desconto da comanda pelos itens, ao cêntimo.
 *
 * O desconto é lançado uma vez, sobre a visita inteira, mas a comissão é por
 * item — cada linha tem a sua profissional. Antes de saber quanto se paga a
 * cada uma é preciso saber quanto é que cada item passou a valer.
 *
 * O reparte é proporcional ao preço, e a conta é feita sobre o acumulado em vez
 * de linha a linha. A diferença é toda em arredondamento: 10 € de desconto
 * sobre três itens de 30 € dava 3,33 + 3,33 + 3,33 = 9,99 se cada linha fosse
 * arredondada por si, e a soma das bases de comissão ficava um cêntimo acima do
 * que a cliente pagou. Um cêntimo não é dinheiro; ao fim de um mês de comandas
 * é uma diferença entre o que entrou e o que se deve que não fecha com nada e
 * que ninguém consegue explicar. Arredondando o acumulado, o cêntimo que sobra
 * cai numa das linhas em vez de se perder, e a soma bate sempre.
 *
 * Devolve o desconto de cada item, na mesma ordem em que os preços entraram.
 */
export function ratearDesconto(precos: readonly number[], desconto: number): number[] {
  const total = precos.reduce((soma, preco) => soma + preco, 0)
  /* Comanda sem valor — tudo oferecido, ou uma lista vazia. Não há proporção
     nenhuma a aplicar, e dividir por zero devolveria NaN até ao banco. */
  if (total <= 0 || desconto <= 0) return precos.map(() => 0)

  const partes: number[] = []
  let precoAcumulado = 0
  let rateado = 0
  for (const preco of precos) {
    precoAcumulado += preco
    const ateAqui = Math.round((desconto * precoAcumulado) / total)
    partes.push(ateAqui - rateado)
    rateado = ateAqui
  }
  return partes
}
