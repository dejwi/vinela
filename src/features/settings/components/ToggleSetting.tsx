import { Switch } from '@/shared/components/ui/switch'

interface ToggleSettingProps {
  /** Unique ID for the switch element */
  id: string
  /** Current on/off state */
  checked: boolean
  /** Called when toggled */
  onCheckedChange: (checked: boolean) => void
  /** Optional aria-describedby ID */
  describedBy?: string
}

export function ToggleSetting({
  id,
  checked,
  onCheckedChange,
  describedBy,
}: ToggleSettingProps): React.JSX.Element {
  return (
    <Switch
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-describedby={describedBy}
    />
  )
}
