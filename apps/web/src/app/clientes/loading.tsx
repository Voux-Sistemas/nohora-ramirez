import { Carregando, CabecalhoFalso, PautaFalsa } from '@/components/ui/esqueleto'

export default function CarregandoClientes() {
  return (
    <Carregando>
      <CabecalhoFalso />
      <PautaFalsa linhas={8} />
    </Carregando>
  )
}
