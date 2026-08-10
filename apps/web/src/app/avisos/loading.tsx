import { Barra, Carregando } from '@/components/ui/esqueleto'

/* A fila conta cinco rotinas antes de desenhar as abas — cinco consultas antes
   do primeiro pixel útil. É a espera mais longa da operação depois da agenda. */
export default function CarregandoAvisos() {
  return (
    <Carregando>
      <Barra className="h-8 w-40" />
      <Barra className="mt-3 h-4 w-56" />

      <div className="mt-7 flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Barra key={i} className="h-9 w-28" />
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Barra key={i} className="h-28 w-full" />
        ))}
      </div>
    </Carregando>
  )
}
