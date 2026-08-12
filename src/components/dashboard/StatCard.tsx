import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/utils'

type Tone = 'primary' | 'teal' | 'neutral'

const TONE_CLASSES: Record<Tone, string> = {
  primary:
    'border-primary bg-primary/8 text-primary shadow-lg shadow-primary/15',
  teal: 'border-brand-teal bg-brand-teal/8 text-brand-teal shadow-lg shadow-brand-teal/15',
  neutral: 'border-border bg-muted/40 text-foreground shadow-sm',
}

interface Props {
  label: string
  value: number
  suffix?: string
  hint?: string
  tone?: Tone
}

/** Cifra de contexto con bloque de color por tono, brillo a juego y conteo animado. */
export function StatCard({ label, value, suffix = '', hint, tone = 'neutral' }: Props) {
  const animado = useCountUp(value)

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5',
        TONE_CLASSES[tone],
      )}
    >
      <p className="text-4xl font-bold tabular-nums tracking-tight">
        {animado}
        {suffix}
      </p>
      <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  )
}
