import { useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Info } from 'lucide-react'
import { explanations } from '@/lib/explanations'

interface InfoTooltipProps {
  paramKey: string
}

export function InfoTooltip({ paramKey }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const explanation = explanations[paramKey]
  if (!explanation) return null

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className="inline-flex items-center justify-center rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Info: ${explanation.label}`}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-72 rounded-md border bg-card p-3 text-sm shadow-md animate-in fade-in-50"
          sideOffset={5}
        >
          <p className="font-medium mb-1">{explanation.label}</p>
          <p className="text-muted-foreground text-xs leading-relaxed">{explanation.description}</p>
          {explanation.range && (
            <p className="text-xs text-muted-foreground mt-1.5 border-t pt-1.5">
              Plage normale : {explanation.range}
            </p>
          )}
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
