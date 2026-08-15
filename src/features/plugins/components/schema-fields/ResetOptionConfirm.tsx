import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'

interface ResetOptionConfirmProps {
  open: boolean
  optionLabel: string
  description?: string | undefined
  onConfirm: () => void
  onCancel: () => void
}

export function ResetOptionConfirm({
  open,
  optionLabel,
  description,
  onConfirm,
  onCancel,
}: ResetOptionConfirmProps): React.JSX.Element {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Reset <strong>{optionLabel}</strong> to its default?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description ??
              'Your edited value and any include-toggle override will be cleared.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Reset</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
