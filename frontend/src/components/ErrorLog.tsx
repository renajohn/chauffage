import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ErrorEntry } from '@/types/heatpump'
import { translateError, type TranslatedError } from '@/lib/errorTranslations'

interface ErrorLogProps {
  errors: ErrorEntry[]
  onReset?: () => Promise<unknown>
}

function formatDate(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ts
  }
}

const severityConfig = {
  critical: {
    badge: 'destructive' as const,
    label: 'Critique',
    border: 'border-l-red-500',
    bg: 'bg-red-50 dark:bg-red-950/20',
  },
  warning: {
    badge: 'warning' as const,
    label: 'Attention',
    border: 'border-l-yellow-500',
    bg: 'bg-yellow-50 dark:bg-yellow-950/20',
  },
  info: {
    badge: 'secondary' as const,
    label: 'Info',
    border: 'border-l-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/20',
  },
}

function ErrorItem({ error }: { error: ErrorEntry }) {
  const translated: TranslatedError = translateError(error.code, error.description)
  const config = severityConfig[translated.severity]

  return (
    <div className={`border-l-4 ${config.border} ${config.bg} rounded-r-lg p-3 space-y-1.5`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={config.badge} className="text-xs">
          {config.label}
        </Badge>
        <span className="font-medium text-sm">{translated.label}</span>
        <span className="text-xs text-muted-foreground ml-auto">{formatDate(error.timestamp)}</span>
      </div>
      <p className="text-sm text-foreground">{translated.description}</p>
      <p className="text-sm text-primary font-medium">→ {translated.advice}</p>
      <p className="text-xs text-muted-foreground italic">Message original : {translated.originalMessage}</p>
    </div>
  )
}

export function ErrorLog({ errors, onReset }: ErrorLogProps) {
  const [pending, setPending] = useState(false)
  const [confirm, setConfirm] = useState(false)

  async function handleReset() {
    if (!confirm) {
      setConfirm(true)
      return
    }
    if (!onReset) return
    setPending(true)
    setConfirm(false)
    try {
      await onReset()
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>⚠️</span> Dernières erreurs
          </CardTitle>
          {onReset && errors.length > 0 && (
            <Button
              size="sm"
              variant={confirm ? 'destructive' : 'outline'}
              onClick={handleReset}
              disabled={pending}
            >
              {pending ? 'Reset...' : confirm ? 'Confirmer reset ?' : 'Reset erreurs'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {errors.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune erreur enregistrée</p>
        ) : (
          <div className="space-y-3">
            {errors.map((err, i) => (
              <ErrorItem key={i} error={err} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
