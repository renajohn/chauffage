import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cn } from '@/lib/utils'

interface SeparatorProps {
  className?: string
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}

export function Separator({ className, orientation = 'horizontal', decorative = true }: SeparatorProps) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
    />
  )
}
