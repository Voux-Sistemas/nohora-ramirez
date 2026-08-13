/**
 * Aritmética de calendário sobre datas de parede (`YYYY-MM-DD`).
 *
 * Tudo aqui é contagem no calendário, não deslocamento no tempo — por isso
 * `Date.UTC` e nunca `new Date(iso)` com hora local. Somar um dia a "31 de
 * Março" tem de dar "1 de Abril" mesmo na noite em que o relógio muda, e é
 * exactamente aí que a versão com fuso erra por uma hora e devolve o mesmo dia.
 *
 * A semana começa à segunda: é a semana portuguesa, não a do índice 0 do
 * `Date`.
 */

export type Vista = 'dia' | 'semana' | 'mes'

export function ehVista(valor: string | undefined): valor is Vista {
  return valor === 'dia' || valor === 'semana' || valor === 'mes'
}

function partes(data: string): [number, number, number] {
  const [ano, mes, dia] = data.split('-').map(Number)
  return [ano ?? 1970, mes ?? 1, dia ?? 1]
}

function escrever(instante: Date): string {
  return instante.toISOString().slice(0, 10)
}

export function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = partes(data)
  return escrever(new Date(Date.UTC(ano, mes - 1, dia + dias)))
}

export function somarMeses(data: string, meses: number): string {
  const [ano, mes, dia] = partes(data)
  /* Dia 31 mais um mês não é 31 de Fevereiro. `Date.UTC` transborda para Março,
     o que aqui seria errado: quem carrega em "mês seguinte" a 31 de Janeiro
     quer Fevereiro. Prendemos ao último dia do mês de destino. */
  const ultimo = new Date(Date.UTC(ano, mes - 1 + meses + 1, 0)).getUTCDate()
  return escrever(new Date(Date.UTC(ano, mes - 1 + meses, Math.min(dia, ultimo))))
}

/** 0 = domingo … 6 = sábado, para uma data de parede. */
export function diaDaSemana(data: string): number {
  const [ano, mes, dia] = partes(data)
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
}

/** A segunda-feira da semana desta data. */
export function segundaDaSemana(data: string): string {
  const semana = diaDaSemana(data)
  // domingo (0) pertence à semana que começou seis dias antes
  const recuo = semana === 0 ? 6 : semana - 1
  return somarDias(data, -recuo)
}

export function primeiroDoMes(data: string): string {
  const [ano, mes] = partes(data)
  return `${ano}-${String(mes).padStart(2, '0')}-01`
}

export function ultimoDoMes(data: string): string {
  const [ano, mes] = partes(data)
  return escrever(new Date(Date.UTC(ano, mes, 0)))
}

/** O intervalo fechado que uma vista cobre. */
export function intervaloDaVista(vista: Vista, data: string): { de: string; ate: string } {
  if (vista === 'dia') return { de: data, ate: data }
  if (vista === 'semana') {
    const de = segundaDaSemana(data)
    return { de, ate: somarDias(de, 6) }
  }
  return { de: primeiroDoMes(data), ate: ultimoDoMes(data) }
}

/** A data para onde o botão de avançar/recuar leva, em cada vista. */
export function deslocarVista(vista: Vista, data: string, passo: 1 | -1): string {
  if (vista === 'dia') return somarDias(data, passo)
  if (vista === 'semana') return somarDias(data, passo * 7)
  return somarMeses(data, passo)
}

/**
 * As seis semanas que a grade do mês desenha, começando à segunda.
 *
 * Seis e não "as que couberem": uma grade que muda de altura conforme o mês faz
 * o conteúdo abaixo saltar ao mudar de mês, e a pessoa perde o botão que
 * acabou de carregar.
 */
export function grelhaDoMes(data: string): string[][] {
  const inicio = segundaDaSemana(primeiroDoMes(data))
  return Array.from({ length: 6 }, (_, semana) =>
    Array.from({ length: 7 }, (_, dia) => somarDias(inicio, semana * 7 + dia)),
  )
}

export function mesmoMes(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}
