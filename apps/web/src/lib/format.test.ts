import { afterEach, describe, expect, it } from 'vitest'
import { formatMoney, formatPhone, formatPhoneLive, telefoneInvalidoErro, toE164 } from './format'

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
