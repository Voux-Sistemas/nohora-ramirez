import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Alvo de toque de 44px por padrão: a recepção usa tablet com a mão ocupada.
 * `sm` existe para densidade em tabela, não para uso geral. `xl` é a ação
 * principal da cliente no celular, onde o polegar chega de baixo.
 *
 * A ação principal é tinta, não bronze. O bronze da identidade é fio e selo —
 * um botão de bronze sobre pedra clara não chega a 4.5:1 e, pior, dilui o
 * detalhe que faz o sistema parecer caro. Preto sobre pedra é o que a própria
 * logo já dizia.
 */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-plate font-medium',
    'transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out',
    'active:translate-y-px',
    'disabled:pointer-events-none disabled:opacity-40 disabled:active:translate-y-0',
    'aria-disabled:pointer-events-none aria-disabled:opacity-40',
  ],
  {
    variants: {
      variant: {
        /* Inverso, não tinta: o botão primário precisa contrastar com a página
           em que está, então ele acompanha o esquema. Tinta é marca e fica
           parada — ver a divisão dos dois papéis em globals.css. */
        primary: [
          'bg-(--surface-invert) text-(--on-invert) shadow-(--shadow-raise)',
          'hover:bg-(--surface-invert-hover) hover:shadow-(--shadow-lift)',
        ],
        outline: [
          'border border-(--border-strong) bg-(--surface-raised) text-(--text-strong)',
          'hover:border-(--surface-invert) hover:bg-(--surface-sunken)',
        ],
        ghost: 'text-(--text-body) hover:bg-(--surface-sunken) hover:text-(--text-strong)',
        /* Sobre a superfície de tinta a lógica inverte: quem age é a pedra
           clara. Usado na tela do selo, que é inteira de tinta. */
        'on-ink': [
          'bg-(--on-ink) text-(--surface-ink) shadow-(--shadow-raise)',
          'hover:shadow-(--shadow-lift) hover:brightness-[1.06]',
        ],
        'on-ink-outline': [
          'border border-(--border-on-ink) text-(--on-ink)',
          'hover:border-(--on-ink) hover:bg-(--on-ink)/8',
        ],
        danger: [
          'border border-(--color-signal-bad)/35 text-(--color-signal-bad)',
          'hover:bg-(--color-signal-bad)/8 hover:border-(--color-signal-bad)/60',
        ],
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-7 text-base tracking-[0.01em]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
