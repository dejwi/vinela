import { useProjectNeovimOptions } from '@/features/settings/hooks/useProjectNeovimOptions'
import { KeyCaptureInput } from '@/shared/components/KeyCaptureInput'

interface KeyCaptureProps {
  value: string
  onChange: (value: string) => void
}

/**
 * Thin wrapper around KeyCaptureInput that injects the project's leader key
 * from settings. Used by the keymaps feature where leader key context is available.
 */
export function KeyCapture({
  value,
  onChange,
}: KeyCaptureProps): React.JSX.Element {
  const { leaderKey } = useProjectNeovimOptions()

  return (
    <KeyCaptureInput value={value} onChange={onChange} leaderKey={leaderKey} />
  )
}
