'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * "Marcar pago" é a tela mais sensível do produto — dinheiro, sem volta — e
 * disparava direto de um clique só. Aqui o clique abre uma confirmação que
 * repete profissional e valor por extenso; só o segundo clique, sobre o texto
 * certo, envia o formulário que já embrulha este componente. Sem modal: o
 * produto não tem nenhum, e a confirmação inline cabe na própria linha.
 */
export function ConfirmarPagamento({ nome, valor }: { nome: string; valor: string }) {
  const [confirmando, setConfirmando] = useState(false)

  if (!confirmando) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setConfirmando(true)}>
        Marcar pago
      </Button>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
      <p className="text-muted text-xs">
        Pagar <span className="text-(--text-strong) font-medium">{valor}</span> a{' '}
        <span className="text-(--text-strong) font-medium">{nome}</span>?
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmando(false)}>
          cancelar
        </Button>
        <Button type="submit" size="sm">
          confirmar
        </Button>
      </div>
    </div>
  )
}
