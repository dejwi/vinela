import { Loader2 } from 'lucide-react'

interface GenerationProgressProps {
  message: string
}

export function GenerationProgress({
  message,
}: GenerationProgressProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
