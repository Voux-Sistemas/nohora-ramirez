'use client'

import type { ChangeEvent, InputHTMLAttributes } from 'react'
import { apenasDigitos, formatPhoneLive } from '@/lib/format'
import { pais } from '@/lib/pais'

type PhoneInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode'>

/**
 * `<input type="tel">` com máscara ao vivo: só aceita dígito e agrupa como o
 * país agrupa (`lib/pais.ts`) enquanto a pessoa digita.
 *
 * Não controlado de propósito — reformatar `value` a cada tecla num input
 * controlado é o padrão clássico que joga o cursor pro fim do campo a cada
 * letra digitada. Aqui quem escreve no DOM é o próprio handler, então o
 * cursor fica exatamente onde ele o deixa.
 */
export function PhoneInput({ onChange, placeholder, defaultValue, ...props }: PhoneInputProps) {
  const { exemploTelemovel } = pais()

  function aoDigitar(e: ChangeEvent<HTMLInputElement>) {
    const campo = e.target
    const posicaoAntes = campo.selectionStart ?? campo.value.length
    const digitosAntesDoCursor = apenasDigitos(campo.value.slice(0, posicaoAntes)).length

    const formatado = formatPhoneLive(campo.value)
    campo.value = formatado

    let restantes = digitosAntesDoCursor
    let posicao = 0
    while (posicao < formatado.length && restantes > 0) {
      if (formatado[posicao] !== ' ') restantes--
      posicao++
    }
    campo.setSelectionRange(posicao, posicao)

    onChange?.(e)
  }

  return (
    <input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder={placeholder ?? exemploTelemovel}
      defaultValue={typeof defaultValue === 'string' ? formatPhoneLive(defaultValue) : defaultValue}
      onChange={aoDigitar}
      {...props}
    />
  )
}
