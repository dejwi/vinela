import { AlertTriangle, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
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
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/shared/components/ui/card'
import type { InstalledPlugin } from '@/shared/types'

export interface OrphanedPluginCardProps {
  schemaId: string
  installed: InstalledPlugin
  onRemove: (schemaId: string) => void
  onFindSchema?: (schemaId: string) => void
}

export function OrphanedPluginCard({
  schemaId,
  installed,
  onRemove,
  onFindSchema,
}: OrphanedPluginCardProps): React.JSX.Element {
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const configKeys = Object.keys(installed.config || {}).length
  const dateStr = new Date(installed.addedAt).toLocaleDateString()

  const handleConfirmRemove = (): void => {
    setShowRemoveDialog(false)
    onRemove(schemaId)
  }

  return (
    <Card className="flex h-full flex-col border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex flex-col space-y-1.5">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold leading-none tracking-tight text-amber-700 dark:text-amber-400">
              {schemaId}
            </h3>
          </div>
          <p className="text-sm text-amber-600/80 dark:text-amber-400/80">
            Schema missing or corrupted
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-amber-500 text-amber-600 dark:border-amber-400 dark:text-amber-400"
        >
          Orphaned
        </Badge>
      </CardHeader>

      <CardContent className="flex-1 pb-4">
        <div className="text-sm text-muted-foreground space-y-1">
          <p>This plugin is installed but its schema cannot be found.</p>
          <ul className="list-inside list-disc text-xs mt-2">
            <li>Installed on: {dateStr}</li>
            <li>
              Saved settings: {configKeys} {configKeys === 1 ? 'key' : 'keys'}
            </li>
            <li>Status: {installed.enabled ? 'Enabled' : 'Disabled'}</li>
          </ul>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between border-t border-amber-500/20 bg-amber-500/10 p-4 dark:border-amber-400/20 dark:bg-amber-400/10">
        {onFindSchema && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onFindSchema(schemaId)}
            className="border-amber-500/50 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-400/20"
          >
            <Search className="mr-2 h-4 w-4" />
            Find Schema
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowRemoveDialog(true)}
          className="ml-auto"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Remove
        </Button>
      </CardFooter>

      {/* Remove confirmation dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove orphaned plugin?</AlertDialogTitle>
            <AlertDialogDescription>
              This plugin&apos;s schema is missing. Removing it will delete the
              installation record and {configKeys}{' '}
              {configKeys === 1 ? 'saved setting' : 'saved settings'}. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
