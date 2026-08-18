import { afterEach, describe, expect, it } from 'vitest'
import {
  formatMoney,
  formatPhone,
  formatPhoneLive,
  formatWeekdayShort,
  partesDoPreco,
  telefoneInvalidoErro,
  toE164,
} from './format'

/*
  Importado por caminho relativo, não por `@/`: assim o vitest roda sem precisar
  saber ler o `paths` do tsconfig, e o teste não depende de configuração para
  existir.
*/

const emPais = (codigo: string, corpo: () => void) => {
  process.env.PAIS = codigo
  corpo()
}

afterEach(() => {
  delete process.env.PAIS
})

describe('telefone português', () => {
  it('aceita os nove dígitos como a cliente digita', () => {
    emPais('PT', () => {
      expect(toE164('934730344')).toBe('+351934730344')
      expect(toE164('934 730 344')).toBe('+351934730344')
      expect(toE164('+351 934 730 344')).toBe('+351934730344')
      /* Prefixo de saída internacional que muita gente ainda digita. */
      expect(toE164('00351934730344')).toBe('+351934730344')
    })
  })

  it('recusa o que não tem nove dígitos', () => {
    emPais('PT', () => {
      expect(toE164('93473034')).toBeNull()
      expect(toE164('9347303445')).toBeNull()
      expect(toE164('')).toBeNull()
    })
  })

  it('escreve o número em grupos de três', () => {
    emPais('PT', () => {
      expect(formatPhone('+351934730344')).toBe('934 730 344')
      /* Fixo do Porto: abre por 2, mesmo comprimento. */
      expect(formatPhone('+351220000000')).toBe('220 000 000')
    })
  })

  it('devolve intacto o número de outro país', () => {
    emPais('PT', () => {
      /* Uma cliente que veio do Brasil, ou registo antigo. Formatar com a régua
         errada inventaria um número — e é a recepção que vai discar. */
      expect(formatPhone('+5511998887777')).toBe('+5511998887777')
    })
  })

  it('agrupa em três enquanto a cliente ainda está digitando', () => {
    emPais('PT', () => {
      expect(formatPhoneLive('9')).toBe('9')
      expect(formatPhoneLive('912')).toBe('912')
      expect(formatPhoneLive('9123')).toBe('912 3')
      expect(formatPhoneLive('912345678')).toBe('912 345 678')
      /* Dígito a mais é cortado, não empurra um quarto grupo. */
      expect(formatPhoneLive('9123456789')).toBe('912 345 678')
      /* Caractere que não é dígito nunca aparece na máscara. */
      expect(formatPhoneLive('912-345 abc678')).toBe('912 345 678')
    })
  })

  it('tira o indicativo antes de cortar, senão corrompe o número gravado', () => {
    emPais('PT', () => {
      /* O campo recebe o valor da base em E.164 — este é o caminho por onde a
         máscara estragava a ficha de quem já estava cadastrada. */
      expect(formatPhoneLive('+351934730344')).toBe('934 730 344')
      expect(formatPhoneLive('00351934730344')).toBe('934 730 344')
      /* E o resultado tem de voltar a ser o mesmo número, não outro. */
      expect(toE164(formatPhoneLive('+351934730344'))).toBe('+351934730344')
    })
  })

  it('não parte a máscara a meio de quem digita o indicativo à mão', () => {
    emPais('PT', () => {
      /* `351` ainda não é indicativo mais número nacional — é só três dígitos
         escritos. Descartá-los aqui apagaria o que a pessoa acabou de teclar. */
      expect(formatPhoneLive('3')).toBe('3')
      expect(formatPhoneLive('351')).toBe('351')
      expect(formatPhoneLive('3519')).toBe('351 9')
      /* E zero à frente não é prefixo de saída se não vier indicativo atrás. */
      expect(formatPhoneLive('00')).toBe('00')
    })
  })

  it('erro de telefone fala telemóvel e nove dígitos, nunca DDD', () => {
    emPais('PT', () => {
      expect(telefoneInvalidoErro()).toBe('Telefone inválido. Indique o telemóvel com 9 dígitos.')
    })
  })
})

describe('telefone brasileiro', () => {
  it('continua a valer quando o país é BR', () => {
    emPais('BR', () => {
      expect(toE164('11998887777')).toBe('+5511998887777')
      expect(toE164('+55 11 99888-7777')).toBe('+5511998887777')
      expect(formatPhone('+5511998887777')).toBe('(11) 99888-7777')
      expect(formatPhone('+551133334444')).toBe('(11) 3333-4444')
    })
  })

  it('não confunde o DDD 55 com o indicativo 55', () => {
    emPais('BR', () => {
      /* Santa Maria/RS. Tirar o "55" da frente deixaria nove dígitos, que não é
         comprimento nacional válido — então o número inteiro é o nacional. */
      expect(toE164('55998887777')).toBe('+5555998887777')
      /* A máscara tem de fazer a mesma leitura: tirar o "55" deixaria nove
         dígitos, que não é comprimento brasileiro — logo o número é inteiro.
         Ao vivo os grupos separam-se por espaço; parêntese e traço são de
         `formatPhone`, que só escreve número já completo. */
      expect(formatPhoneLive('55998887777')).toBe('55 99888 7777')
      /* Já com indicativo a sério, o que sobra tem onze e o indicativo sai. */
      expect(formatPhoneLive('+5511998887777')).toBe('11 99888 7777')
    })
  })

  it('erro de telefone troca de vocabulário junto com o país', () => {
    emPais('BR', () => {
      expect(telefoneInvalidoErro()).toBe('Telefone inválido. Indique o celular com 10 ou 11 dígitos.')
    })
  })
})

describe('dinheiro', () => {
  it('sai em euro no formato europeu', () => {
    emPais('PT', () => {
      /* Espaço estreito antes do símbolo é o que o ICU devolve em pt-PT. */
      expect(formatMoney(1500).replace(/ /g, ' ')).toBe('15,00 €')
      expect(formatMoney(18000).replace(/ /g, ' ')).toBe('180,00 €')
    })
  })

  it('sai em real quando o país é BR', () => {
    emPais('BR', () => {
      expect(formatMoney(1500).replace(/ /g, ' ')).toBe('R$ 15,00')
    })
  })

  it('sem país declarado assume Portugal, que é onde o sistema está', () => {
    delete process.env.PAIS
    expect(formatMoney(1500).replace(/ /g, ' ')).toBe('15,00 €')
  })
})

describe('dia da semana na grelha', () => {
  it('abrevia a três letras, que é o que o calendário português usa', () => {
    emPais('PT', () => {
      /* O ICU devolve "segunda", "domingo", "sábado" em `weekday: short` — a
         palavra inteira transbordava a coluna do telemóvel. */
      expect(formatWeekdayShort('2026-08-16')).toBe('dom')
      expect(formatWeekdayShort('2026-08-17')).toBe('seg')
      expect(formatWeekdayShort('2026-08-18')).toBe('ter')
      expect(formatWeekdayShort('2026-08-19')).toBe('qua')
      expect(formatWeekdayShort('2026-08-20')).toBe('qui')
      expect(formatWeekdayShort('2026-08-21')).toBe('sex')
      expect(formatWeekdayShort('2026-08-22')).toBe('sáb')
    })
  })
})

/*
  O preçário da montra escreve cinquenta e oito destes. Um arredondamento aqui
  publica na montra um preço que o salão não cobra — é a razão de isto não ser
  o `formatMoneyShort`, que arredonda de propósito para painéis.
*/
describe('preço partido para o preçário', () => {
  it('larga os cêntimos quando eles são zero', () => {
    emPais('PT', () => {
      expect(partesDoPreco(1500)).toEqual({ valor: '15', moeda: '€' })
      expect(partesDoPreco(18000)).toEqual({ valor: '180', moeda: '€' })
    })
  })

  it('mantém os cêntimos quando eles são preço, e nunca arredonda', () => {
    emPais('PT', () => {
      expect(partesDoPreco(1250)).toEqual({ valor: '12,50', moeda: '€' })
      expect(partesDoPreco(1299)).toEqual({ valor: '12,99', moeda: '€' })
    })
  })

  it('separa o símbolo, para a coluna de números ficar só com números', () => {
    emPais('PT', () => {
      const { valor, moeda } = partesDoPreco(12000)
      expect(valor).not.toContain('€')
      expect(moeda).toBe('€')
    })
  })
})
